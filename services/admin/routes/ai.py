"""Admin & customer AI chat endpoints.

Owns every ``/api/v1/ai/**`` and ``/api/v1/super/ai-**`` route: customer
salesman chat (REST + SSE), admin assistant chat with action confirmation,
session/message browsing, CSV export, super-admin monitoring + provider
status, embedding lifecycle, and AI-settings CRUD.
"""

import csv
import io
import json as _json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse as _StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from shared.auth_middleware import (
    require_admin,
    require_staff,
    require_super_admin,
)
from utils.encryption import encrypt_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI"])




@router.post("/api/v1/ai/customer/chat", tags=["AI"])
async def ai_customer_chat(request: Request, db: Session = Depends(get_db)):
    """
    Customer AI Salesman — public endpoint (no auth required).
    Accepts: { message, session_id?, language?, cart_context? }
    Returns: { session_id, reply, tool_results, tokens_used, cost_usd }
    """
    from service.ai_service import customer_chat

    body = await request.json()
    message = str(body.get("message", "")).strip()
    session_id = body.get("session_id")
    language = body.get("language", "auto")
    cart_context = body.get("cart_context")  # optional: {items, total, item_count}
    user_id = None

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 chars)")

    # Extract user_id from HttpOnly cookie (preferred) or Authorization header (fallback)
    try:
        cookie_token = request.cookies.get("access_token")
        auth_header = request.headers.get("Authorization", "")
        token = cookie_token or (auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None)
        if token:
            from shared.auth_middleware import auth_middleware
            payload = auth_middleware.decode_token(token)
            user_info = auth_middleware.extract_user_info(payload)
            user_id = user_info.get("user_id")
    except Exception:
        pass

    return customer_chat(db, message, session_id, user_id, language=language, cart_context=cart_context)


@router.post("/api/v1/ai/customer/chat/stream", tags=["AI"])
async def ai_customer_chat_stream(request: Request, db: Session = Depends(get_db)):
    """
    SSE streaming variant of customer AI chat.
    Accepts: { message, session_id?, language?, cart_context? }
    Returns: text/event-stream with chunks: data: {"chunk": "..."} and final: data: {"done": true, ...}
    """
    from service.ai_service import customer_chat
    from fastapi.responses import StreamingResponse as _StreamingResponse
    import asyncio, json as _json

    body = await request.json()
    message = str(body.get("message", "")).strip()
    session_id = body.get("session_id")
    language = body.get("language", "auto")
    cart_context = body.get("cart_context")
    user_id = None

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 chars)")

    try:
        cookie_token = request.cookies.get("access_token")
        auth_header = request.headers.get("Authorization", "")
        token = cookie_token or (auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None)
        if token:
            from shared.auth_middleware import auth_middleware
            payload = auth_middleware.decode_token(token)
            user_info = auth_middleware.extract_user_info(payload)
            user_id = user_info.get("user_id")
    except Exception:
        pass

    async def event_generator():
        try:
            # Run the blocking customer_chat in a thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: customer_chat(db, message, session_id, user_id, language=language, cart_context=cart_context)
            )
            reply = result.get("reply", "")
            # Stream the reply character-by-character in chunks for typing effect
            CHUNK_SIZE = 3
            for i in range(0, len(reply), CHUNK_SIZE):
                chunk = reply[i:i + CHUNK_SIZE]
                yield f"data: {_json.dumps({'chunk': chunk})}\n\n"
                await asyncio.sleep(0.008)
            # Final event with full metadata
            yield f"data: {_json.dumps({'done': True, 'session_id': result.get('session_id'), 'tool_results': result.get('tool_results'), 'tokens_used': result.get('tokens_used', 0)})}\n\n"
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"data: {_json.dumps({'error': True, 'chunk': 'I ran into a small issue. Please try again! 🌸'})}\n\n"
            yield f"data: {_json.dumps({'done': True})}\n\n"

    return _StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/api/v1/ai/admin/chat", tags=["AI"])
async def ai_admin_chat(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    """
    Admin AI Assistant — staff/admin only, full agentic tool suite.
    Accepts: { message, session_id?, images?: [{mime_type, data (base64)}] }
    Returns: { session_id, reply, tool_calls, tokens_used, cost_usd }
    """
    from service.ai_service import admin_chat

    body = await request.json()
    message = str(body.get("message", "")).strip()
    session_id = body.get("session_id")
    images = body.get("images")  # optional multimodal

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 chars)")

    user_id = current_user["user_id"]
    return admin_chat(db, message, session_id, user_id, image_data=images)


@router.get("/api/v1/ai/admin/sessions", tags=["AI"])
async def get_ai_sessions(
    role: Optional[str] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get AI session list for analytics (admin only)."""
    where = f"WHERE s.created_at >= NOW() - INTERVAL '{int(days)} days'"
    params: dict = {}
    if role in ("customer", "admin"):
        where += " AND s.role = :role"
        params["role"] = role

    sessions = db.execute(
        text(f"""
        SELECT s.session_id, s.role, s.user_id, u.email,
               s.message_count, s.total_tokens_in, s.total_tokens_out,
               s.total_cost, s.created_at, s.last_activity
        FROM ai_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        {where}
        ORDER BY s.last_activity DESC LIMIT 100
    """),
        params,
    ).fetchall()

    return {
        "sessions": [
            {
                "session_id": r[0],
                "role": r[1],
                "user_id": r[2],
                "email": r[3],
                "messages": r[4],
                "tokens_in": r[5],
                "tokens_out": r[6],
                "cost_usd": float(r[7] or 0),
                "created_at": str(r[8]),
                "last_activity": str(r[9]),
            }
            for r in sessions
        ]
    }


@router.post("/api/v1/ai/admin/execute-action", tags=["AI"])
async def execute_ai_action(
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    Execute a previously confirmed pending AI action.
    Called by admin after reviewing the pending action in the confirmation modal.
    DELETE operations are never supported here.
    """
    from service.ai_service import execute_confirmed_action

    action_type = data.get("action_type", "")
    params = data.get("params", {})
    admin_user_id = current_user.get("user_id")

    allowed_actions = {
        "ship_order",
        "update_product_price",
        "bulk_update_category_prices",
        "adjust_stock",
        "create_product_draft",
    }
    if action_type not in allowed_actions:
        raise HTTPException(
            status_code=400, detail=f"Action '{action_type}' is not permitted."
        )

    result = execute_confirmed_action(db, action_type, params, admin_user_id)
    if not result.get("success"):
        raise HTTPException(
            status_code=422, detail=result.get("message", "Action failed.")
        )
    return result


@router.get("/api/v1/ai/admin/analytics", tags=["AI"])
async def get_ai_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get AI usage + cost analytics (admin only)."""
    from service.ai_service import get_ai_analytics

    return get_ai_analytics(db, days)


# ── pgvector embedding management endpoints ───────────────────────────────────


@router.post("/api/v1/ai/embeddings/refresh", tags=["AI Embeddings"])
async def refresh_all_embeddings(
    batch_size: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    DEPRECATED: Embedding generation is not supported by Groq and other OpenAI-compatible providers.
    
    This endpoint is kept for backward compatibility but will return a notice.
    Consider using an external embedding service (e.g., OpenAI, Cohere) if embeddings are needed.
    
    batch_size controls how many products to process per call (max 200).
    """
    from service.ai_service import generate_product_embeddings_batch

    size = min(batch_size, 200)
    result = generate_product_embeddings_batch(db, batch_size=size)
    if not result.get("success"):
        raise HTTPException(
            status_code=503, detail=result.get("error", "Embedding generation failed")
        )
    return result


@router.post("/api/v1/ai/embeddings/refresh-all", tags=["AI Embeddings"])
async def refresh_all_embeddings_force(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """
    Force-regenerate embeddings for ALL products (overwrite existing).
    Use this after a bulk product description update.
    """
    from service.ai_service import generate_product_embeddings_batch
    from sqlalchemy import text as sa_text

    db.execute(sa_text("UPDATE products SET embedding = NULL"))
    db.commit()
    result = generate_product_embeddings_batch(db, batch_size=500)
    return result


@router.post("/api/v1/ai/embeddings/product/{product_id}", tags=["AI Embeddings"])
async def refresh_single_embedding(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Generate or refresh embedding for a single product by ID."""
    from service.ai_service import generate_single_product_embedding

    result = generate_single_product_embedding(db, product_id)
    if not result.get("success"):
        raise HTTPException(
            status_code=503, detail=result.get("error", "Embedding generation failed")
        )
    return result


@router.get("/api/v1/ai/embeddings/status", tags=["AI Embeddings"])
async def get_embedding_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get current embedding coverage stats for all products."""
    from sqlalchemy import text as sa_text

    total = db.execute(sa_text("SELECT COUNT(*) FROM products")).scalar() or 0
    with_emb = (
        db.execute(
            sa_text("SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL")
        ).scalar()
        or 0
    )
    without_emb = total - with_emb
    coverage_pct = round((with_emb / total * 100) if total > 0 else 0, 1)
    return {
        "total_products": total,
        "with_embeddings": with_emb,
        "without_embeddings": without_emb,
        "coverage_percent": coverage_pct,
        "ready_for_semantic_search": with_emb > 0,
        "message": f"{with_emb}/{total} products indexed ({coverage_pct}%)",
    }


@router.get("/api/v1/super/ai-monitoring", tags=["AI"])
async def get_ai_monitoring(
    days: int = 30,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_super_admin),
):
    """Full AI monitoring: daily chart, per-model, per-user, recent sessions."""
    role_clause = "AND s.role = :role" if role else ""
    params: dict = {"days": days}
    if role:
        params["role"] = role

    # Daily cost/token breakdown for chart
    daily = db.execute(
        text(f"""
        SELECT DATE(m.created_at) as day,
               SUM(m.tokens_in) as tokens_in,
               SUM(m.tokens_out) as tokens_out,
               SUM(m.cost) as cost,
               COUNT(*) as messages,
               m.model_used
        FROM ai_messages m
        JOIN ai_sessions s ON s.session_id = m.session_id
        WHERE m.created_at >= NOW() - INTERVAL '{days} days'
          AND m.role = 'assistant'
          {role_clause}
        GROUP BY DATE(m.created_at), m.model_used
        ORDER BY day ASC
    """),
        params,
    ).fetchall()

    # Per-model summary
    by_model = db.execute(
        text(f"""
        SELECT m.model_used,
               COUNT(DISTINCT s.session_id) as sessions,
               COUNT(*) FILTER (WHERE m.role = 'assistant') as responses,
               SUM(m.tokens_in) as tokens_in,
               SUM(m.tokens_out) as tokens_out,
               SUM(m.cost) as cost
        FROM ai_messages m
        JOIN ai_sessions s ON s.session_id = m.session_id
        WHERE m.created_at >= NOW() - INTERVAL '{days} days'
          {role_clause}
        GROUP BY m.model_used
    """),
        params,
    ).fetchall()

    # Top 10 users by cost
    top_users = db.execute(
        text(f"""
        SELECT u.email, u.username, s.role,
               COUNT(DISTINCT s.session_id) as sessions,
               SUM(s.total_cost) as cost
        FROM ai_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.created_at >= NOW() - INTERVAL '{days} days'
          {role_clause}
        GROUP BY u.email, u.username, s.role
        ORDER BY cost DESC LIMIT 10
    """),
        params,
    ).fetchall()

    # Summary totals
    totals = db.execute(
        text(f"""
        SELECT COUNT(DISTINCT session_id) as sessions,
               SUM(total_tokens_in) as tokens_in,
               SUM(total_tokens_out) as tokens_out,
               SUM(total_cost) as cost,
               SUM(message_count) as messages
        FROM ai_sessions
        WHERE created_at >= NOW() - INTERVAL '{days} days'
          {role_clause}
    """),
        params,
    ).fetchone()

    # Today's cost
    today_cost = (
        db.execute(
            text(f"""
        SELECT COALESCE(SUM(cost), 0) FROM ai_messages
        WHERE created_at >= CURRENT_DATE
        AND role = 'assistant'
    """)
        ).scalar()
        or 0
    )

    return {
        "period_days": days,
        "totals": {
            "sessions": totals[0] or 0,
            "tokens_in": totals[1] or 0,
            "tokens_out": totals[2] or 0,
            "cost_usd": float(totals[3] or 0),
            "messages": totals[4] or 0,
        },
        "today_cost_usd": float(today_cost),
        "daily": [
            {
                "date": str(r[0]),
                "tokens_in": r[1] or 0,
                "tokens_out": r[2] or 0,
                "cost_usd": float(r[3] or 0),
                "messages": r[4],
                "model": r[5],
            }
            for r in daily
        ],
        "by_model": [
            {
                "model": r[0],
                "sessions": r[1],
                "responses": r[2],
                "tokens_in": r[3] or 0,
                "tokens_out": r[4] or 0,
                "cost_usd": float(r[5] or 0),
            }
            for r in by_model
        ],
        "top_users": [
            {
                "email": r[0],
                "username": r[1],
                "role": r[2],
                "sessions": r[3],
                "cost_usd": float(r[4] or 0),
            }
            for r in top_users
        ],
    }


@router.get("/api/v1/ai/admin/sessions/{session_id}/messages", tags=["AI"])
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get all messages for a specific AI session."""
    session = db.execute(
        text("""
        SELECT s.session_id, s.role, s.user_id, u.email, u.username,
               s.message_count, s.total_tokens_in, s.total_tokens_out,
               s.total_cost, s.created_at, s.last_activity
        FROM ai_sessions s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.session_id = :sid
    """),
        {"sid": session_id},
    ).fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.execute(
        text("""
        SELECT id, role, content, tokens_in, tokens_out, cost,
               model_used, tool_calls, tool_results, image_urls, created_at
        FROM ai_messages WHERE session_id = :sid ORDER BY created_at ASC
    """),
        {"sid": session_id},
    ).fetchall()

    return {
        "session": {
            "session_id": session[0],
            "role": session[1],
            "user_id": session[2],
            "email": session[3],
            "username": session[4],
            "message_count": session[5],
            "tokens_in": session[6],
            "tokens_out": session[7],
            "cost_usd": float(session[8] or 0),
            "created_at": str(session[9]),
            "last_activity": str(session[10]),
        },
        "messages": [
            {
                "id": r[0],
                "role": r[1],
                "content": r[2],
                "tokens_in": r[3],
                "tokens_out": r[4],
                "cost_usd": float(r[5] or 0),
                "model": r[6],
                "tool_calls": r[7],
                "tool_results": r[8],
                "has_images": bool(r[9]),
                "created_at": str(r[10]),
            }
            for r in messages
        ],
    }


@router.get("/api/v1/ai/admin/export/csv", tags=["AI"])
async def export_ai_sessions_csv(
    days: int = 30,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Export AI sessions as CSV download."""
    import csv, io

    role_clause = (
        f"AND s.role = '{role}'" if role and role in ("customer", "admin") else ""
    )
    rows = db.execute(
        text(f"""
        SELECT s.session_id, s.role, u.email, u.username,
               s.message_count, s.total_tokens_in, s.total_tokens_out,
               s.total_cost, s.created_at, s.last_activity
        FROM ai_sessions s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.created_at >= NOW() - INTERVAL '{days} days'
          {role_clause}
        ORDER BY s.last_activity DESC
    """)
    ).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "session_id",
            "role",
            "email",
            "username",
            "messages",
            "tokens_in",
            "tokens_out",
            "cost_usd",
            "created_at",
            "last_activity",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r[0],
                r[1],
                r[2] or "",
                r[3] or "",
                r[4],
                r[5],
                r[6],
                f"{float(r[7] or 0):.8f}",
                str(r[8]),
                str(r[9]),
            ]
        )

    content = buf.getvalue().encode("utf-8")
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=ai_sessions_{days}d.csv"
        },
    )


# ── AI Settings (CRUD) ────────────────────────────────────────────────────────

from utils.encryption import encrypt_api_key, decrypt_api_key


@router.get("/api/v1/super/ai-settings", tags=["AI Settings"])
async def get_ai_settings(
    db: Session = Depends(get_db), current_user: dict = Depends(require_super_admin)
):
    """Get all AI settings (secrets masked)."""
    rows = db.execute(
        text("""
        SELECT key, value, description, is_secret, category, updated_at
        FROM ai_settings ORDER BY category, key
    """)
    ).fetchall()
    return {
        "settings": [
            {
                "key": r[0],
                "value": "••••••••" if r[3] and r[1] else r[1],
                "raw_set": bool(r[1]),
                "description": r[2],
                "is_secret": r[3],
                "category": r[4],
                "updated_at": str(r[5]),
            }
            for r in rows
        ]
    }


@router.get("/api/v1/super/ai-providers/status", tags=["AI Providers"])
async def get_ai_providers_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_super_admin),
):
    """Get real-time status of all AI providers with rate limits and usage."""
    try:
        from core.ai_key_rotation import get_provider_status
        status = get_provider_status(db)
        return {
            "providers": status,
            "total_providers": len(status),
            "enabled_providers": sum(1 for p in status if p["enabled"]),
        }
    except Exception as e:
        logger.error(f"Failed to get AI provider status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get provider status: {str(e)}")


@router.post("/api/v1/super/ai-settings/test-key", tags=["AI Settings"])
async def test_api_key(
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_super_admin),
):
    """Test an API key for any supported AI provider."""
    key = data.get("api_key", "").strip()
    provider = data.get("provider", "groq")

    if not key or key == "__current__":
        # Get from environment
        key = os.environ.get(f"{provider.upper()}_API_KEY", "")

    if not key:
        raise HTTPException(status_code=400, detail="No API key configured")

    try:
        # Test Groq (PRIMARY provider)
        if provider == "groq":
            from groq import Groq
            client = Groq(api_key=key)
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": "Say 'ok' in one word"}],
                max_tokens=5
            )
            return {"valid": True, "response": resp.choices[0].message.content.strip(), "provider": provider}

        # Test OpenRouter
        elif provider == "openrouter":
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url="https://openrouter.ai/api/v1")
            resp = client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[{"role": "user", "content": "Say 'ok' in one word"}],
                max_tokens=5
            )
            return {"valid": True, "response": resp.choices[0].message.content.strip(), "provider": provider}

        # Test GLM
        elif provider == "glm":
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url="https://open.bigmodel.cn/api/paas/v4")
            resp = client.chat.completions.create(
                model="glm-4-flash",
                messages=[{"role": "user", "content": "Say 'ok' in one word"}],
                max_tokens=5
            )
            return {"valid": True, "response": resp.choices[0].message.content.strip(), "provider": provider}

        # Test NVIDIA
        elif provider == "nvidia":
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url="https://integrate.api.nvidia.com/v1")
            resp = client.chat.completions.create(
                model="meta/llama3-70b-instruct",
                messages=[{"role": "user", "content": "Say 'ok' in one word"}],
                max_tokens=5
            )
            return {"valid": True, "response": resp.choices[0].message.content.strip(), "provider": provider}

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}. Supported: groq, openrouter, glm, nvidia")

    except Exception as e:
        return {"valid": False, "error": str(e), "provider": provider}


@router.put("/api/v1/super/ai-settings/bulk", tags=["AI Settings"])
async def bulk_update_ai_settings(
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_super_admin),
):
    """Bulk update multiple AI settings at once. API keys are automatically encrypted."""
    settings_data: dict = data.get("settings", {})
    user_id = current_user.get("user_id")
    now = datetime.now(timezone.utc)
    
    for k, value in settings_data.items():
        # Encrypt API keys
        is_api_key = k.endswith("_API_KEY")
        value_to_store = encrypt_api_key(value) if is_api_key and value else value
        
        existing = db.execute(
            text("SELECT id FROM ai_settings WHERE key = :k"), {"k": k}
        ).fetchone()
        if existing:
            db.execute(
                text("""
                UPDATE ai_settings SET value = :v, updated_at = :now, updated_by = :uid WHERE key = :k
            """),
                {"v": value_to_store, "now": now, "uid": user_id, "k": k},
            )
        else:
            db.execute(
                text("""
                INSERT INTO ai_settings (key, value, updated_by, updated_at) VALUES (:k, :v, :uid, :now)
            """),
                {"k": k, "v": value_to_store, "uid": user_id, "now": now},
            )
        
        # Update environment variable (decrypted for runtime)
        if is_api_key and value:
            os.environ[k] = value
    
    db.commit()
    return {"success": True, "updated": list(settings_data.keys()), "encrypted_keys": [k for k in settings_data.keys() if k.endswith("_API_KEY")]}


@router.put("/api/v1/super/ai-settings/{key}", tags=["AI Settings"])
async def update_ai_setting(
    key: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_super_admin),
):
    """Update a single AI setting value. API keys are automatically encrypted."""
    value = data.get("value", "")
    user_id = current_user.get("user_id")
    
    # Check if this is an API key that should be encrypted
    is_api_key = key.endswith("_API_KEY")
    value_to_store = encrypt_api_key(value) if is_api_key and value else value

    existing = db.execute(
        text("SELECT id FROM ai_settings WHERE key = :k"), {"k": key}
    ).fetchone()
    if existing:
        db.execute(
            text("""
            UPDATE ai_settings SET value = :v, updated_at = :now, updated_by = :uid
            WHERE key = :k
        """),
            {"v": value_to_store, "now": datetime.now(timezone.utc), "uid": user_id, "k": key},
        )
    else:
        db.execute(
            text("""
            INSERT INTO ai_settings (key, value, updated_by, updated_at)
            VALUES (:k, :v, :uid, :now)
        """),
            {"k": key, "v": value_to_store, "uid": user_id, "now": datetime.now(timezone.utc)},
        )
    db.commit()

    # Also update environment variable (decrypt if needed for runtime use)
    if is_api_key and value:
        os.environ[key] = value  # Store decrypted in env for runtime use

    return {"success": True, "key": key, "encrypted": is_api_key and value}
