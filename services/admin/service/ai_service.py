"""
AI Service — Aarya Clothing
Handles both Customer AI Salesman and Admin AI Assistant.

Architecture:
  - Single provider: Google Gemini Flash (cheapest, free tier, multimodal)
  - Customer: minimal system prompt, 6-message history, product tools only
  - Admin: full tool suite, 10-message history, agentic API calls, image support
  - Cost tracking: every call logs tokens + cost to ai_messages/ai_sessions tables

Pricing (Gemini 2.0 Flash Lite as of 2026):
  - Input:  $0.075 / 1M tokens
  - Output: $0.30  / 1M tokens
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from sqlalchemy.orm import Session
from sqlalchemy import text

# Optional AI providers — fail gracefully if not installed
try:
    from openai import OpenAI as _OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    _OpenAI = None
    OPENAI_AVAILABLE = False

try:
    import anthropic as _anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic = None
    ANTHROPIC_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── Pricing constants (USD per token) ───────────────────────────────────────
GEMINI_FLASH_LITE = "gemini-2.0-flash-lite"
GEMINI_FLASH     = "gemini-2.0-flash"

PRICE_PER_TOKEN = {
    # Gemini
    GEMINI_FLASH_LITE: {"input": 0.075 / 1_000_000, "output": 0.30 / 1_000_000},
    GEMINI_FLASH:      {"input": 0.10  / 1_000_000, "output": 0.40 / 1_000_000},
    # OpenAI (GPT-4o-mini as budget option)
    "gpt-4o-mini":      {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000},
    "gpt-4o":           {"input": 2.50 / 1_000_000, "output": 10.0 / 1_000_000},
    # Groq (free tier models)
    "llama-3.3-70b-versatile": {"input": 0.00 / 1_000_000, "output": 0.00 / 1_000_000},
    "mixtral-8x7b-32768":    {"input": 0.00 / 1_000_000, "output": 0.00 / 1_000_000},
    # Anthropic (Claude)
    "claude-3-haiku-20240307": {"input": 0.25 / 1_000_000, "output": 1.25 / 1_000_000},
    "claude-3-5-sonnet-20241022": {"input": 3.00 / 1_000_000, "output": 15.0 / 1_000_000},
}

# ── System prompts ────────────────────────────────────────────────────────────
CUSTOMER_SYSTEM_PROMPT_EN = """You are Aarya, a friendly AI fashion assistant for Aarya Clothing — a premium Indian fashion brand.

Your role: Help customers discover beautiful clothing they'll love.

Rules:
- Keep responses SHORT (2-4 sentences max). Be warm, enthusiastic, and fashion-forward.
- Never make up product details. Only use data from tool results.
- If user asks about new arrivals, promotions, or categories → use the tools.
- Guide confused users: ask if they want to see New Arrivals, Collections, or a specific style.
- Never discuss orders, payments, or account issues — redirect to support.
- Respond in English only.
"""

CUSTOMER_SYSTEM_PROMPT_HI = """आप Aarya हैं — Aarya Clothing के लिए एक मित्रवत AI फैशन सहायक, जो एक प्रीमियम भारतीय फैशन ब्रांड है।

आपकी भूमिका: ग्राहकों को उनके पसंदीदा कपड़े खोजने में मदद करना।

नियम:
- जवाब छोटे रखें (2-4 वाक्य)। गर्मजोशी और उत्साह के साथ बोलें।
- कभी भी उत्पाद विवरण न बनाएं। केवल टूल परिणामों से डेटा का उपयोग करें।
- नए आगमन, प्रमोशन, या कलेक्शन के बारे में पूछने पर → टूल का उपयोग करें।
- हमेशा हिंदी में जवाब दें, लेकिन उत्पाद के नाम और प्राइस अंग्रेज़ी में रख सकते हैं।
- ऑर्डर, भुगतान या खाता संबंधी प्रश्नों पर सपोर्ट की ओर निर्देशित करें।
"""

CUSTOMER_SYSTEM_PROMPT_AUTO = """You are Aarya, a friendly AI fashion assistant for Aarya Clothing — a premium Indian fashion brand.

Your role: Help customers discover beautiful clothing they'll love.

LANGUAGE RULES (very important):
- Detect the customer's language from their message.
- If they write in Hindi/Hinglish → respond in Hindi (Devanagari script preferred, Hinglish acceptable).
- If they write in English → respond in English.
- Keep responses SHORT (2-4 sentences max). Be warm and fashion-forward.
- Never make up product details. Only use data from tool results.
- If user asks about new arrivals, promotions, or categories → use the tools.
- Never discuss orders, payments, or account issues — redirect to support.

Hindi example: "बिल्कुल! 🌸 यहाँ हमारे नए कुर्तियाँ हैं जो आपको पसंद आएंगी।"
"""

# Default (auto-detect)
CUSTOMER_SYSTEM_PROMPT = CUSTOMER_SYSTEM_PROMPT_AUTO

ADMIN_SYSTEM_PROMPT = """You are Aria, an intelligent AI assistant for the Aarya Clothing admin panel.

Your role: Help admins and staff manage the store efficiently through natural conversation.

Capabilities (use tools for all data operations):
- View orders, revenue, inventory, customers (read tools)
- Ship orders, update prices, adjust stock, create products (write tools — ALWAYS requires confirmation)
- Generate business insights from data

CRITICAL RULES — You MUST follow these without exception:
1. NEVER delete anything. You have no delete capability — do not suggest or attempt deletion.
2. For ALL write operations (shipping, price changes, stock adjustments, product creation):
   - Use the appropriate write tool to create a PENDING ACTION for admin approval.
   - NEVER execute a write operation without admin confirmation.
   - Tell the admin what action you've prepared and ask them to confirm.
3. Be concise and business-focused. Use ₹ for currency, commas for thousands.
4. Always use tools for real data — never guess or fabricate numbers.
5. Proactively suggest related actions after providing data.
"""

# Friendly error messages for users (never expose raw exceptions)
ERROR_MESSAGES = {
    "api_key": "AI service is not configured. Please set your API key in AI Configuration.",
    "quota": "AI service is rate-limited. Please wait a moment and try again.",
    "network": "Network error reaching AI service. Please check your connection.",
    "default": "Something went wrong. Please try again in a moment.",
}

def _friendly_error(e: Exception) -> str:
    msg = str(e).lower()
    if "api key" in msg or "authentication" in msg or "invalid_api" in msg:
        return ERROR_MESSAGES["api_key"]
    if "quota" in msg or "rate" in msg or "429" in msg:
        return ERROR_MESSAGES["quota"]
    if "connection" in msg or "network" in msg or "timeout" in msg:
        return ERROR_MESSAGES["network"]
    return ERROR_MESSAGES["default"]


# Write tool names — these create pending actions, NEVER auto-execute
WRITE_TOOLS = frozenset({
    "ship_order", "update_product_price", "bulk_update_category_prices",
    "adjust_stock", "create_product_draft",
})


def _get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key or key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY not configured. Set it in .env file.")
    return key


# ── pgvector embedding helpers ────────────────────────────────────────────────

def _product_embed_text(name: str, description: str = "", category: str = "", tags: str = "") -> str:
    """Build rich text for embedding — name + category + description + tags."""
    parts = [f"Product: {name}"]
    if category:
        parts.append(f"Category: {category}")
    if description:
        parts.append(f"Description: {description[:400]}")
    if tags:
        parts.append(f"Tags: {tags}")
    return " | ".join(parts)


def _generate_embedding(text_input: str, api_key: str) -> Optional[List[float]]:
    """Generate embedding using Gemini gemini-embedding-001 (768-dim)."""
    try:
        genai.configure(api_key=api_key)
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text_input,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Embedding generation error: {e}")
        return None


def _vec_str(embedding: List[float]) -> str:
    """Convert float list to Postgres vector literal string."""
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


def _calc_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    prices = PRICE_PER_TOKEN.get(model, PRICE_PER_TOKEN[GEMINI_FLASH_LITE])
    return (tokens_in * prices["input"]) + (tokens_out * prices["output"])


# ── Session management ────────────────────────────────────────────────────────

def get_or_create_session(db: Session, session_id: str, user_id: Optional[int], role: str) -> str:
    """Return existing session_id or create new one."""
    if session_id:
        row = db.execute(
            text("SELECT session_id FROM ai_sessions WHERE session_id = :sid"),
            {"sid": session_id}
        ).fetchone()
        if row:
            db.execute(
                text("UPDATE ai_sessions SET last_activity = :now WHERE session_id = :sid"),
                {"now": datetime.now(timezone.utc), "sid": session_id}
            )
            db.commit()
            return session_id

    new_sid = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO ai_sessions (session_id, user_id, role, created_at, last_activity)
            VALUES (:sid, :uid, :role, :now, :now)
        """),
        {"sid": new_sid, "uid": user_id, "role": role, "now": datetime.now(timezone.utc)}
    )
    db.commit()
    return new_sid


def get_session_history(db: Session, session_id: str, max_messages: int = 8) -> List[Dict]:
    """Fetch last N messages from DB for context."""
    rows = db.execute(
        text("""
            SELECT role, content, tool_calls, tool_results
            FROM ai_messages
            WHERE session_id = :sid
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"sid": session_id, "limit": max_messages}
    ).fetchall()
    # Reverse to chronological order
    messages = []
    for row in reversed(rows):
        if row[0] in ("user", "assistant"):
            messages.append({"role": row[0], "parts": [row[1] or ""]})
    return messages


def save_message(db: Session, session_id: str, role: str, content: str,
                 tokens_in: int, tokens_out: int, model: str,
                 tool_calls=None, tool_results=None, image_urls=None):
    cost = _calc_cost(model, tokens_in, tokens_out)
    db.execute(
        text("""
            INSERT INTO ai_messages
                (session_id, role, content, tokens_in, tokens_out, cost, model_used,
                 tool_calls, tool_results, image_urls, created_at)
            VALUES
                (:sid, :role, :content, :ti, :to_, :cost, :model,
                 :tc, :tr, :iu, :now)
        """),
        {
            "sid": session_id, "role": role, "content": content,
            "ti": tokens_in, "to_": tokens_out, "cost": cost, "model": model,
            "tc": json.dumps(tool_calls) if tool_calls else None,
            "tr": json.dumps(tool_results) if tool_results else None,
            "iu": json.dumps(image_urls) if image_urls else None,
            "now": datetime.now(timezone.utc),
        }
    )
    db.execute(
        text("""
            UPDATE ai_sessions SET
                total_tokens_in  = total_tokens_in  + :ti,
                total_tokens_out = total_tokens_out + :to_,
                total_cost       = total_cost       + :cost,
                message_count    = message_count    + 1,
                last_activity    = :now
            WHERE session_id = :sid
        """),
        {"ti": tokens_in, "to_": tokens_out, "cost": cost,
         "now": datetime.now(timezone.utc), "sid": session_id}
    )
    db.commit()


# ── Customer tools ────────────────────────────────────────────────────────────

def _customer_tools(db: Session) -> List[Dict]:
    return [
        {
            "name": "get_new_arrivals",
            "description": "Get the latest new arrival products. Use when customer wants to see new items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of products (default 6, max 12)"}
                }
            }
        },
        {
            "name": "search_products",
            "description": "Search for products by name, category, color, or style.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "category": {"type": "string", "description": "Optional category filter"},
                    "limit": {"type": "integer", "description": "Number of results (default 6)"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_collections",
            "description": "Get all product collections/categories available in the store.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "get_active_promotions",
            "description": "Get current active promotions and discount codes.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "semantic_search_products",
            "description": "AI-powered semantic product search. Use for vague or intent-based queries like 'something for a wedding', 'casual summer outfit', 'gift for mom'. Better than keyword search for natural language.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language search query"},
                    "limit": {"type": "integer", "description": "Number of results (default 6, max 12)"}
                },
                "required": ["query"]
            }
        }
    ]


def _execute_customer_tool(db: Session, tool_name: str, args: Dict) -> str:
    try:
        if tool_name == "get_new_arrivals":
            limit = min(int(args.get("limit", 6)), 12)
            rows = db.execute(text("""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color) FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size) FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true AND p.is_new_arrival = true
                ORDER BY p.created_at DESC LIMIT :lim
            """), {"lim": limit}).fetchall()
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else []}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products)})

        elif tool_name == "search_products":
            query = args.get("query", "")
            category = args.get("category", "")
            limit = min(int(args.get("limit", 6)), 12)
            cat_clause = "AND c.name ILIKE :cat" if category else ""
            qparams: Dict[str, Any] = {"q": f"%{query}%", "lim": limit}
            if category:
                qparams["cat"] = f"%{category}%"
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color) FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size) FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true
                  AND (p.name ILIKE :q OR p.description ILIKE :q OR c.name ILIKE :q)
                  {cat_clause}
                ORDER BY p.updated_at DESC LIMIT :lim
            """), qparams).fetchall()
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else []}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products), "query": query})

        elif tool_name == "get_collections":
            rows = db.execute(text("""
                SELECT id, name, description, image_url, slug
                FROM collections WHERE is_active = true
                ORDER BY display_order ASC NULLS LAST, name ASC
            """)).fetchall()
            return json.dumps({
                "collections": [{"id": r[0], "name": r[1], "description": r[2],
                                  "image": r[3], "slug": r[4]} for r in rows]
            })

        elif tool_name == "get_active_promotions":
            rows = db.execute(text("""
                SELECT code, description, discount_type, discount_value, minimum_order
                FROM promotions
                WHERE is_active = true
                  AND (valid_until IS NULL OR valid_until > NOW())
                ORDER BY discount_value DESC LIMIT 5
            """)).fetchall()
            return json.dumps({
                "promotions": [
                    {"code": r[0], "description": r[1], "type": str(r[2]),
                     "value": float(r[3] or 0), "min_order": float(r[4] or 0)}
                    for r in rows
                ]
            })
        elif tool_name == "semantic_search_products":
            query = args.get("query", "")
            limit = min(int(args.get("limit", 6)), 12)
            try:
                api_key = _get_api_key()
                query_vec = _generate_embedding(query, api_key)
            except Exception:
                query_vec = None
            if query_vec is None:
                # Graceful fallback to keyword search
                return _execute_customer_tool(db, "search_products", {"query": query, "limit": limit})
            vec_literal = _vec_str(query_vec)
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color)
                           FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size)
                           FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes,
                       1 - (p.embedding <=> '{vec_literal}'::vector) as similarity
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true AND p.embedding IS NOT NULL
                ORDER BY p.embedding <=> '{vec_literal}'::vector
                LIMIT :lim
            """), {"lim": limit}).fetchall()
            if not rows:
                return _execute_customer_tool(db, "search_products", {"query": query, "limit": limit})
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else [],
                 "similarity": round(float(r[9] or 0), 3)}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products),
                               "query": query, "search_type": "semantic"})

    except Exception as e:
        logger.error(f"Customer tool error [{tool_name}]: {e}")
        return json.dumps({"error": str(e)})

    return json.dumps({"error": "Unknown tool"})


# ── Admin tools ───────────────────────────────────────────────────────────────

def _admin_tools() -> List[Dict]:
    return [
        {
            "name": "get_orders",
            "description": "Get orders list with optional status/date filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["confirmed", "shipped", "delivered", "cancelled"]},
                    "limit": {"type": "integer"},
                    "days": {"type": "integer", "description": "Orders from last N days"}
                }
            }
        },
        {
            "name": "get_order_details",
            "description": "Get full details of a specific order by ID.",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "integer"}},
                "required": ["order_id"]
            }
        },
        {
            "name": "get_revenue_summary",
            "description": "Get revenue analytics: total, daily average, top products, by period.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Period in days (default 30)"}
                }
            }
        },
        {
            "name": "get_inventory_alerts",
            "description": "Get low stock and out-of-stock inventory items.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "get_customer_stats",
            "description": "Get customer statistics: total, new this month, high-value customers.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "search_orders",
            "description": "Search orders by customer name, email, or order ID.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"]
            }
        },
        {
            "name": "get_ai_cost_summary",
            "description": "Get AI usage and cost summary for the store.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Period in days (default 30)"}
                }
            }
        },
        {
            "name": "semantic_search_products",
            "description": "AI semantic product search using vector similarity. Use for intent-based queries or to find similar products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language query"},
                    "limit": {"type": "integer", "description": "Number of results (default 10)"}
                },
                "required": ["query"]
            }
        }
    ]


def _execute_admin_tool(db: Session, tool_name: str, args: Dict) -> str:
    try:
        if tool_name == "get_orders":
            status = args.get("status")
            limit = min(int(args.get("limit", 20)), 100)
            days = args.get("days")
            where = "WHERE 1=1"
            params: Dict[str, Any] = {"lim": limit}
            if status:
                where += " AND o.status = :status"
                params["status"] = status
            if days:
                where += f" AND o.created_at >= NOW() - INTERVAL '{int(days)} days'"
            rows = db.execute(text(f"""
                SELECT o.id, o.status, o.total_amount, o.tracking_number,
                       o.created_at, u.email, u.username
                FROM orders o JOIN users u ON u.id = o.user_id
                {where}
                ORDER BY o.created_at DESC LIMIT :lim
            """), params).fetchall()
            return json.dumps({
                "orders": [
                    {"id": r[0], "status": str(r[1]), "total": float(r[2]),
                     "tracking": r[3], "created_at": str(r[4]),
                     "customer_email": r[5], "customer": r[6]}
                    for r in rows
                ],
                "count": len(rows)
            })

        elif tool_name == "get_order_details":
            oid = int(args["order_id"])
            row = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.tracking_number, o.shipping_address,
                       o.created_at, o.shipped_at, o.delivered_at,
                       u.email, u.username,
                       o.payment_method, o.transaction_id, o.order_notes
                FROM orders o JOIN users u ON u.id = o.user_id
                WHERE o.id = :oid
            """), {"oid": oid}).fetchone()
            if not row:
                return json.dumps({"error": f"Order #{oid} not found"})
            items = db.execute(text("""
                SELECT product_name, quantity, unit_price, size, color
                FROM order_items WHERE order_id = :oid
            """), {"oid": oid}).fetchall()
            return json.dumps({
                "order": {
                    "id": row[0], "status": str(row[1]), "total": float(row[2]),
                    "tracking": row[3], "address": row[4],
                    "created_at": str(row[5]), "shipped_at": str(row[6]),
                    "delivered_at": str(row[7]),
                    "customer": row[9], "email": row[8],
                    "payment": row[10], "notes": row[12]
                },
                "items": [
                    {"product": r[0], "qty": r[1], "price": float(r[2]),
                     "size": r[3], "color": r[4]}
                    for r in items
                ]
            })

        elif tool_name == "get_revenue_summary":
            days = int(args.get("days", 30))
            stats = db.execute(text(f"""
                SELECT
                    COALESCE(SUM(total_amount), 0) as total_rev,
                    COUNT(*) as total_orders,
                    COALESCE(AVG(total_amount), 0) as avg_order,
                    COUNT(DISTINCT user_id) as unique_customers
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                  AND status != 'cancelled'
            """)).fetchone()
            top_products = db.execute(text(f"""
                SELECT p.name, SUM(oi.quantity) as sold, SUM(oi.unit_price * oi.quantity) as revenue
                FROM order_items oi
                JOIN inventory i ON i.id = oi.inventory_id
                JOIN products p ON p.id = i.product_id
                JOIN orders o ON o.id = oi.order_id
                WHERE o.created_at >= NOW() - INTERVAL '{days} days'
                  AND o.status != 'cancelled'
                GROUP BY p.id, p.name
                ORDER BY revenue DESC LIMIT 5
            """)).fetchall()
            return json.dumps({
                "period_days": days,
                "total_revenue": float(stats[0]),
                "total_orders": stats[1],
                "avg_order_value": float(stats[2]),
                "unique_customers": stats[3],
                "daily_avg_revenue": float(stats[0]) / max(days, 1),
                "top_products": [
                    {"name": r[0], "units_sold": r[1], "revenue": float(r[2])}
                    for r in top_products
                ]
            })

        elif tool_name == "get_inventory_alerts":
            low = db.execute(text("""
                SELECT i.sku, p.name, i.quantity, i.low_stock_threshold
                FROM inventory i JOIN products p ON p.id = i.product_id
                WHERE i.quantity <= i.low_stock_threshold AND i.quantity > 0
                ORDER BY i.quantity ASC LIMIT 15
            """)).fetchall()
            oos = db.execute(text("""
                SELECT i.sku, p.name
                FROM inventory i JOIN products p ON p.id = i.product_id
                WHERE i.quantity = 0 LIMIT 15
            """)).fetchall()
            return json.dumps({
                "low_stock": [{"sku": r[0], "name": r[1], "qty": r[2], "threshold": r[3]} for r in low],
                "out_of_stock": [{"sku": r[0], "name": r[1]} for r in oos],
                "low_stock_count": len(low),
                "out_of_stock_count": len(oos)
            })

        elif tool_name == "get_customer_stats":
            stats = db.execute(text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as new_this_month,
                    COUNT(*) FILTER (WHERE is_active = true) as active
                FROM users WHERE role = 'customer'
            """)).fetchone()
            return json.dumps({
                "total_customers": stats[0],
                "new_this_month": stats[1],
                "active_customers": stats[2]
            })

        elif tool_name == "search_orders":
            q = args.get("query", "")
            rows = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.created_at, u.email, u.username
                FROM orders o JOIN users u ON u.id = o.user_id
                WHERE u.email ILIKE :q OR u.username ILIKE :q
                   OR CAST(o.id AS TEXT) = :exact
                ORDER BY o.created_at DESC LIMIT 10
            """), {"q": f"%{q}%", "exact": q.strip()}).fetchall()
            return json.dumps({
                "orders": [
                    {"id": r[0], "status": str(r[1]), "total": float(r[2]),
                     "created_at": str(r[3]), "email": r[4], "username": r[5]}
                    for r in rows
                ]
            })

        elif tool_name == "get_ai_cost_summary":
            days = int(args.get("days", 30))
            stats = db.execute(text(f"""
                SELECT
                    role,
                    COUNT(*) as sessions,
                    SUM(message_count) as messages,
                    SUM(total_tokens_in) as tokens_in,
                    SUM(total_tokens_out) as tokens_out,
                    SUM(total_cost) as cost
                FROM ai_sessions
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                GROUP BY role
            """)).fetchall()
            return json.dumps({
                "period_days": days,
                "by_role": [
                    {"role": r[0], "sessions": r[1], "messages": r[2],
                     "tokens_in": r[3], "tokens_out": r[4],
                     "cost_usd": float(r[5] or 0)}
                    for r in stats
                ]
            })

        elif tool_name == "semantic_search_products":
            query = args.get("query", "")
            limit = min(int(args.get("limit", 10)), 50)
            try:
                api_key = _get_api_key()
                query_vec = _generate_embedding(query, api_key)
            except Exception:
                query_vec = None
            if query_vec is None:
                return json.dumps({"error": "Embedding generation failed. Use keyword search instead."})
            vec_literal = _vec_str(query_vec)
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.base_price, p.is_active,
                       COALESCE((
                           SELECT SUM(i.quantity - i.reserved_quantity)
                           FROM inventory i
                           WHERE i.product_id = p.id AND i.is_active = true
                       ), 0) as total_stock,
                       c.name as category,
                       1 - (p.embedding <=> '{vec_literal}'::vector) as similarity
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.embedding IS NOT NULL
                ORDER BY p.embedding <=> '{vec_literal}'::vector
                LIMIT :lim
            """), {"lim": limit}).fetchall()
            products = [
                {"id": r[0], "name": r[1], "price": float(r[2] or 0),
                 "active": r[3], "stock": r[4], "category": r[5],
                 "similarity": round(float(r[6] or 0), 3)}
                for r in rows
            ]
            embedded_count = db.execute(text(
                "SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL"
            )).scalar() or 0
            total_count = db.execute(text(
                "SELECT COUNT(*) FROM products"
            )).scalar() or 0
            return json.dumps({
                "products": products, "count": len(products), "query": query,
                "search_type": "semantic",
                "coverage": f"{embedded_count}/{total_count} products have embeddings"
            })

    except Exception as e:
        logger.error(f"Admin tool error [{tool_name}]: {e}")
        return json.dumps({"error": str(e)})

    return json.dumps({"error": "Unknown tool"})


# ── Admin WRITE tool definitions (create pending actions, never auto-execute) ─

def _admin_write_tool_definitions() -> List[Dict]:
    """Write tools that the AI can call to build pending actions for admin confirmation."""
    return [
        {
            "name": "ship_order",
            "description": "Prepare to mark an order as shipped with a POD/tracking number. Creates a PENDING ACTION that requires admin confirmation before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "Order ID to ship"},
                    "tracking_number": {"type": "string", "description": "POD or tracking number"},
                    "carrier": {"type": "string", "description": "Carrier name (optional)"},
                },
                "required": ["order_id", "tracking_number"]
            }
        },
        {
            "name": "update_product_price",
            "description": "Prepare to update a product's price. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "new_price": {"type": "number", "description": "New price in INR"},
                    "reason": {"type": "string", "description": "Reason for change"},
                },
                "required": ["product_id", "new_price"]
            }
        },
        {
            "name": "bulk_update_category_prices",
            "description": "Prepare to bulk-update prices for all products in a category by a percentage. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_name": {"type": "string"},
                    "percent_change": {"type": "number", "description": "+10 = increase 10%, -5 = reduce 5%"},
                },
                "required": ["category_name", "percent_change"]
            }
        },
        {
            "name": "adjust_stock",
            "description": "Prepare to adjust inventory quantity for a SKU. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string"},
                    "quantity_change": {"type": "integer", "description": "Positive to add, negative to reduce"},
                    "reason": {"type": "string"},
                },
                "required": ["sku", "quantity_change"]
            }
        },
        {
            "name": "create_product_draft",
            "description": "Prepare to create a new product draft. Creates a PENDING ACTION requiring confirmation. Product will be created as inactive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "base_price": {"type": "number"},
                    "category_name": {"type": "string"},
                    "description": {"type": "string"},
                    "tags": {"type": "string", "description": "Comma-separated tags"},
                },
                "required": ["name", "base_price", "category_name"]
            }
        },
    ]


def _build_pending_action(db: Session, tool_name: str, args: Dict) -> Dict:
    """Build rich pending action context for admin confirmation. Never modifies DB."""
    try:
        if tool_name == "ship_order":
            oid = args.get("order_id")
            tracking = args.get("tracking_number", "")
            row = db.execute(text(
                "SELECT status FROM orders WHERE id = :oid"
            ), {"oid": oid}).fetchone()
            warning = None
            if row and str(row[0]) != "confirmed":
                warning = f"Order is currently '{row[0]}' — not 'confirmed'. Shipping may fail."
            return {
                "type": tool_name,
                "params": args,
                "description": f"Mark Order #{oid} as SHIPPED with tracking: {tracking}",
                "warning": warning,
            }

        elif tool_name == "update_product_price":
            pid = args.get("product_id")
            new_price = float(args.get("new_price", 0))
            row = db.execute(text(
                "SELECT name, base_price FROM products WHERE id = :pid"
            ), {"pid": pid}).fetchone()
            if row:
                return {
                    "type": tool_name, "params": args,
                    "description": f"Update price of '{row[0]}': ₹{float(row[1]):,.0f} → ₹{new_price:,.0f}",
                    "warning": None,
                }
            return {
                "type": tool_name, "params": args,
                "description": f"Update price for product #{pid} to ₹{new_price:,.0f}",
                "warning": f"Product #{pid} not found — please verify.",
            }

        elif tool_name == "bulk_update_category_prices":
            cat = args.get("category_name", "")
            pct = float(args.get("percent_change", 0))
            count = db.execute(text(
                "SELECT COUNT(*) FROM products p JOIN collections c ON c.id=p.category_id WHERE c.name ILIKE :c AND p.is_active=true"
            ), {"c": f"%{cat}%"}).scalar() or 0
            direction = "increase" if pct > 0 else "decrease"
            return {
                "type": tool_name, "params": args,
                "description": f"Bulk {direction} prices by {abs(pct):.1f}% for {count} active products in '{cat}'",
                "warning": f"Affects {count} products. Review carefully." if count > 5 else (None if count > 0 else f"No active products found in '{cat}'."),
            }

        elif tool_name == "adjust_stock":
            sku = args.get("sku", "")
            qty = int(args.get("quantity_change", 0))
            row = db.execute(text(
                "SELECT p.name, i.quantity FROM inventory i JOIN products p ON p.id=i.product_id WHERE i.sku=:sku"
            ), {"sku": sku}).fetchone()
            current = f" (current: {row[1]} units)" if row else " (SKU not found)"
            return {
                "type": tool_name, "params": args,
                "description": f"{'Add' if qty > 0 else 'Remove'} {abs(qty)} units for SKU '{sku}'{current}",
                "warning": None if row else f"SKU '{sku}' not found in inventory.",
            }

        elif tool_name == "create_product_draft":
            return {
                "type": tool_name, "params": args,
                "description": f"Create product draft: '{args.get('name')}' at ₹{float(args.get('base_price', 0)):,.0f} in '{args.get('category_name')}'",
                "warning": "Product will be saved as inactive (draft). Activate from Products page.",
            }

    except Exception as e:
        logger.error(f"_build_pending_action error [{tool_name}]: {e}")

    return {"type": tool_name, "params": args, "description": f"Execute: {tool_name}", "warning": None}


def execute_confirmed_action(db: Session, action_type: str, params: Dict, admin_user_id: int) -> Dict:
    """
    Execute a write action ONLY after explicit admin confirmation.
    This is the single entry point for all AI-triggered write operations.
    DELETE operations are intentionally absent and will never be added.
    """
    try:
        now = datetime.now(timezone.utc)

        if action_type == "ship_order":
            oid = int(params["order_id"])
            tracking = str(params["tracking_number"])
            result = db.execute(text("""
                UPDATE orders SET status = 'shipped', tracking_number = :trk, shipped_at = :now
                WHERE id = :oid AND status = 'confirmed'
            """), {"trk": tracking, "now": now, "oid": oid})
            db.commit()
            if result.rowcount == 0:
                return {"success": False, "message": f"Order #{oid} could not be shipped (already shipped or not confirmed)."}
            return {"success": True, "message": f"✓ Order #{oid} marked as shipped with tracking {tracking}"}

        elif action_type == "update_product_price":
            pid = int(params["product_id"])
            new_price = float(params["new_price"])
            if new_price <= 0:
                return {"success": False, "message": "Price must be greater than 0."}
            db.execute(text("UPDATE products SET base_price = :p, updated_at = :now WHERE id = :pid"),
                       {"p": new_price, "now": now, "pid": pid})
            db.commit()
            return {"success": True, "message": f"✓ Price updated to ₹{new_price:,.0f} for product #{pid}"}

        elif action_type == "bulk_update_category_prices":
            cat = params["category_name"]
            pct = float(params["percent_change"]) / 100.0
            multiplier = 1.0 + pct
            if multiplier <= 0:
                return {"success": False, "message": "Percent change would result in zero or negative prices."}
            result = db.execute(text("""
                UPDATE products SET base_price = ROUND(base_price * :m, 2), updated_at = :now
                WHERE category_id = (SELECT id FROM collections WHERE name ILIKE :cat LIMIT 1)
                  AND is_active = true
            """), {"m": multiplier, "now": now, "cat": f"%{cat}%"})
            db.commit()
            return {"success": True, "message": f"✓ Bulk price update: {result.rowcount} products updated by {pct*100:+.1f}%"}

        elif action_type == "adjust_stock":
            sku = params["sku"]
            qty = int(params["quantity_change"])
            reason = params.get("reason", "Admin AI adjustment")
            inv_row = db.execute(text("SELECT id, quantity FROM inventory WHERE sku = :sku"), {"sku": sku}).fetchone()
            if not inv_row:
                return {"success": False, "message": f"SKU '{sku}' not found in inventory."}
            new_qty = max(0, inv_row[1] + qty)
            db.execute(text("UPDATE inventory SET quantity = :q, updated_at = :now WHERE sku = :sku"),
                       {"q": new_qty, "now": now, "sku": sku})
            db.execute(text("""
                INSERT INTO inventory_movements (inventory_id, movement_type, quantity_change, reason, created_at, created_by)
                VALUES (:iid, 'adjustment', :qty, :reason, :now, :uid)
            """), {"iid": inv_row[0], "qty": qty, "reason": reason, "now": now, "uid": admin_user_id})
            db.commit()
            return {"success": True, "message": f"✓ Stock for '{sku}': {inv_row[1]} → {new_qty} ({qty:+d})"}

        elif action_type == "create_product_draft":
            cat_id = db.execute(text(
                "SELECT id FROM collections WHERE name ILIKE :n LIMIT 1"
            ), {"n": f"%{params['category_name']}%"}).scalar()
            if not cat_id:
                return {"success": False, "message": f"Category '{params['category_name']}' not found."}
            row = db.execute(text("""
                INSERT INTO products (name, base_price, category_id, description, is_active, created_at, updated_at)
                VALUES (:name, :price, :cat, :desc, false, :now, :now)
                RETURNING id
            """), {
                "name": params["name"], "price": float(params["base_price"]),
                "cat": cat_id, "desc": params.get("description", ""),
                "now": now
            }).fetchone()
            db.commit()
            return {"success": True, "message": f"✓ Product draft created (ID #{row[0]}). Activate it from the Products page.", "product_id": row[0]}

        return {"success": False, "message": f"Unknown action type: '{action_type}'. No changes made."}

    except Exception as e:
        db.rollback()
        logger.error(f"execute_confirmed_action error [{action_type}]: {e}")
        return {"success": False, "message": f"Action failed: {_friendly_error(e)}"}


# ── Main chat functions ───────────────────────────────────────────────────────

def _get_setting(db: Session, key: str, default: str = "") -> str:
    """Fetch a value from ai_settings table, fall back to default."""
    try:
        row = db.execute(
            text("SELECT value FROM ai_settings WHERE key = :k"), {"k": key}
        ).fetchone()
        return row[0] if row and row[0] is not None else default
    except Exception:
        return default


def customer_chat(
    db: Session,
    user_message: str,
    session_id: Optional[str],
    user_id: Optional[int],
    language: str = "auto",  # 'auto' | 'en' | 'hi'
) -> Dict[str, Any]:
    """
    Customer AI Salesman chat.
    Uses Gemini Flash Lite for minimal cost.
    Returns: { session_id, reply, tool_results, tokens_used, cost }
    """
    api_key = _get_api_key()
    genai.configure(api_key=api_key)
    model_name = _get_setting(db, "CUSTOMER_MODEL", os.environ.get("AI_MODEL", GEMINI_FLASH_LITE))
    max_tokens = int(_get_setting(db, "CUSTOMER_MAX_TOKENS", os.environ.get("AI_CUSTOMER_MAX_TOKENS", "512")))
    max_history = int(_get_setting(db, "CUSTOMER_HISTORY", "6"))

    # Pick system prompt based on language setting
    lang = language or _get_setting(db, "CUSTOMER_LANGUAGE", "auto")
    if lang == "hi":
        system_prompt = CUSTOMER_SYSTEM_PROMPT_HI
    elif lang == "en":
        system_prompt = CUSTOMER_SYSTEM_PROMPT_EN
    else:
        system_prompt = CUSTOMER_SYSTEM_PROMPT_AUTO  # auto-detect

    session_id = get_or_create_session(db, session_id or "", user_id, "customer")
    history = get_session_history(db, session_id, max_messages=max_history)

    tools = _customer_tools(db)
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        tools=[{"function_declarations": tools}],
        generation_config={"max_output_tokens": max_tokens, "temperature": 0.7},
    )
    chat = model.start_chat(history=history)

    # Save user message (no tokens yet)
    save_message(db, session_id, "user", user_message, 0, 0, model_name)

    try:
        response = chat.send_message(user_message)
        tokens_in = response.usage_metadata.prompt_token_count or 0
        tokens_out = response.usage_metadata.candidates_token_count or 0

        # Handle tool calls if present
        tool_results = {}
        final_text = ""
        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                result = _execute_customer_tool(db, fc.name, dict(fc.args))
                tool_results[fc.name] = result
                # Second pass with tool result
                follow_up = chat.send_message(
                    genai.protos.Content(parts=[
                        genai.protos.Part(function_response=genai.protos.FunctionResponse(
                            name=fc.name, response={"result": result}
                        ))
                    ])
                )
                tokens_in += follow_up.usage_metadata.prompt_token_count or 0
                tokens_out += follow_up.usage_metadata.candidates_token_count or 0
                final_text = follow_up.text or ""
            elif hasattr(part, "text"):
                final_text += part.text or ""

        final_text = final_text.strip()
        save_message(db, session_id, "assistant", final_text,
                     tokens_in, tokens_out, model_name,
                     tool_results=tool_results if tool_results else None)

        return {
            "session_id": session_id,
            "reply": final_text,
            "tool_results": tool_results,
            "tokens_used": tokens_in + tokens_out,
            "cost_usd": _calc_cost(model_name, tokens_in, tokens_out),
        }

    except Exception as e:
        logger.error(f"Customer chat error: {e}")
        msg = str(e).lower()
        if "api key" in msg or "authentication" in msg:
            friendly = "Our AI assistant is taking a short break. Please try again soon! 🙏"
        elif "quota" in msg or "rate" in msg or "429" in msg:
            friendly = "I'm a bit busy right now — please try again in a moment! 😊"
        else:
            friendly = "I'm having a little trouble right now. Please try again in a moment! 🌸"
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {
            "session_id": session_id,
            "reply": friendly,
            "error": "service_error",
            "tokens_used": 0,
            "cost_usd": 0.0,
        }


def _admin_chat_openai(
    db: Session, user_message: str, session_id: str, user_id: int,
    model_name: str, api_key: str, base_url: Optional[str], max_tokens: int, max_history: int,
) -> Dict[str, Any]:
    """Text-only admin chat via OpenAI-compatible API (OpenAI, Groq, Together, etc.)."""
    client = _OpenAI(api_key=api_key, base_url=base_url)
    history = get_session_history(db, session_id, max_messages=max_history)
    messages: List[Dict] = [{"role": "system", "content": ADMIN_SYSTEM_PROMPT}]
    messages += [{"role": m["role"], "content": m["parts"][0]} for m in history]
    messages.append({"role": "user", "content": user_message})

    save_message(db, session_id, "user", user_message, 0, 0, model_name)
    try:
        resp = client.chat.completions.create(
            model=model_name, messages=messages,
            max_tokens=max_tokens, temperature=0.4,
        )
        reply = resp.choices[0].message.content or ""
        ti = resp.usage.prompt_tokens if resp.usage else 0
        to = resp.usage.completion_tokens if resp.usage else 0
        save_message(db, session_id, "assistant", reply, ti, to, model_name)
        return {
            "session_id": session_id, "reply": reply,
            "tool_calls": [], "pending_actions": [],
            "tokens_used": ti + to,
            "cost_usd": _calc_cost(model_name, ti, to),
            "provider": "openai",
        }
    except Exception as e:
        logger.error(f"OpenAI admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {"session_id": session_id, "reply": friendly, "error": "service_error",
                "tool_calls": [], "pending_actions": [], "tokens_used": 0, "cost_usd": 0.0}


def _admin_chat_anthropic(
    db: Session, user_message: str, session_id: str, user_id: int,
    model_name: str, api_key: str, max_tokens: int, max_history: int,
) -> Dict[str, Any]:
    """Text-only admin chat via Anthropic Claude."""
    client = _anthropic.Anthropic(api_key=api_key)
    history = get_session_history(db, session_id, max_messages=max_history)
    messages: List[Dict] = [{"role": m["role"], "content": m["parts"][0]} for m in history]
    messages.append({"role": "user", "content": user_message})

    save_message(db, session_id, "user", user_message, 0, 0, model_name)
    try:
        resp = client.messages.create(
            model=model_name, max_tokens=max_tokens,
            system=ADMIN_SYSTEM_PROMPT, messages=messages,
        )
        reply = resp.content[0].text if resp.content else ""
        ti = resp.usage.input_tokens if resp.usage else 0
        to = resp.usage.output_tokens if resp.usage else 0
        save_message(db, session_id, "assistant", reply, ti, to, model_name)
        return {
            "session_id": session_id, "reply": reply,
            "tool_calls": [], "pending_actions": [],
            "tokens_used": ti + to,
            "cost_usd": _calc_cost(model_name, ti, to),
            "provider": "anthropic",
        }
    except Exception as e:
        logger.error(f"Anthropic admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {"session_id": session_id, "reply": friendly, "error": "service_error",
                "tool_calls": [], "pending_actions": [], "tokens_used": 0, "cost_usd": 0.0}


def admin_chat(
    db: Session,
    user_message: str,
    session_id: Optional[str],
    user_id: int,
    image_data: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Admin AI Assistant chat.
    Supports Gemini (full tools + pending actions), OpenAI, Anthropic, Groq.
    Write operations always return pending_actions — never auto-execute.
    Returns: { session_id, reply, tool_calls, pending_actions, tokens_used, cost_usd }
    """
    model_name = _get_setting(db, "ADMIN_MODEL", os.environ.get("AI_ADMIN_MODEL", GEMINI_FLASH))
    max_tokens = int(_get_setting(db, "ADMIN_MAX_TOKENS", os.environ.get("AI_ADMIN_MAX_TOKENS", "2048")))
    max_history = int(_get_setting(db, "ADMIN_HISTORY", "10"))
    provider = _get_setting(db, "AI_PROVIDER", "gemini").lower()

    session_id = get_or_create_session(db, session_id or "", user_id, "admin")

    # ── Route to non-Gemini providers (text-only, no tool calling) ───────────
    if provider == "openai" and OPENAI_AVAILABLE:
        api_key = _get_setting(db, "OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
        if not api_key:
            api_key = _get_api_key()  # fallback
        return _admin_chat_openai(db, user_message, session_id, user_id,
                                  model_name, api_key, None, max_tokens, max_history)

    if provider == "groq" and OPENAI_AVAILABLE:
        api_key = _get_setting(db, "GROQ_API_KEY", os.environ.get("GROQ_API_KEY", ""))
        return _admin_chat_openai(db, user_message, session_id, user_id,
                                  model_name, api_key, "https://api.groq.com/openai/v1",
                                  max_tokens, max_history)

    if provider == "anthropic" and ANTHROPIC_AVAILABLE:
        api_key = _get_setting(db, "ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
        return _admin_chat_anthropic(db, user_message, session_id, user_id,
                                     model_name, api_key, max_tokens, max_history)

    # ── Default: Gemini with full tool support ────────────────────────────────
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    # Combine read-only + write tools
    all_tools = _admin_tools() + _admin_write_tool_definitions()
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=ADMIN_SYSTEM_PROMPT,
        tools=[{"function_declarations": all_tools}],
        generation_config={"max_output_tokens": max_tokens, "temperature": 0.4},
    )
    history = get_session_history(db, session_id, max_messages=max_history)
    chat = model.start_chat(history=history)

    parts: List[Any] = [user_message]
    if image_data:
        for img in image_data[:3]:
            parts.append({"mime_type": img["mime_type"], "data": img["data"]})

    save_message(db, session_id, "user", user_message, 0, 0, model_name,
                 image_urls=[img.get("url") for img in (image_data or [])])

    try:
        response = chat.send_message(parts)
        tokens_in = response.usage_metadata.prompt_token_count or 0
        tokens_out = response.usage_metadata.candidates_token_count or 0

        tool_calls_log: Dict = {}
        pending_actions: List[Dict] = []
        final_text = ""

        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                fc_name = fc.name
                fc_args = dict(fc.args)

                if fc_name in WRITE_TOOLS:
                    # Build pending action — DO NOT execute
                    pending = _build_pending_action(db, fc_name, fc_args)
                    pending_actions.append(pending)
                    tool_result = json.dumps({
                        "status": "pending_confirmation",
                        "message": "Action prepared for admin confirmation.",
                    })
                else:
                    tool_result = _execute_admin_tool(db, fc_name, fc_args)

                tool_calls_log[fc_name] = {"args": fc_args}

                follow_up = chat.send_message(
                    genai.protos.Content(parts=[
                        genai.protos.Part(function_response=genai.protos.FunctionResponse(
                            name=fc_name, response={"result": tool_result}
                        ))
                    ])
                )
                tokens_in += follow_up.usage_metadata.prompt_token_count or 0
                tokens_out += follow_up.usage_metadata.candidates_token_count or 0
                final_text = follow_up.text or ""

            elif hasattr(part, "text"):
                final_text += part.text or ""

        final_text = final_text.strip()
        save_message(db, session_id, "assistant", final_text,
                     tokens_in, tokens_out, model_name,
                     tool_calls=tool_calls_log if tool_calls_log else None)

        return {
            "session_id": session_id,
            "reply": final_text,
            "tool_calls": list(tool_calls_log.keys()),
            "pending_actions": pending_actions,
            "tokens_used": tokens_in + tokens_out,
            "cost_usd": _calc_cost(model_name, tokens_in, tokens_out),
            "provider": "gemini",
        }

    except Exception as e:
        logger.error(f"Admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {
            "session_id": session_id,
            "reply": friendly,
            "error": "service_error",
            "tool_calls": [],
            "pending_actions": [],
            "tokens_used": 0,
            "cost_usd": 0.0,
        }


def generate_product_embeddings_batch(
    db: Session,
    product_ids: Optional[List[int]] = None,
    batch_size: int = 50,
) -> Dict[str, Any]:
    """
    Generate / refresh embeddings for products.
    If product_ids is None → regenerates all products without embeddings.
    Returns { updated, skipped, errors, total }.
    """
    try:
        api_key = _get_api_key()
    except ValueError as e:
        return {"success": False, "error": str(e), "updated": 0, "skipped": 0, "errors": 0}

    if product_ids:
        rows = db.execute(text("""
            SELECT p.id, p.name, p.description, c.name as category
            FROM products p
            LEFT JOIN collections c ON c.id = p.category_id
            WHERE p.id = ANY(:ids)
        """), {"ids": product_ids}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT p.id, p.name, p.description, c.name as category
            FROM products p
            LEFT JOIN collections c ON c.id = p.category_id
            WHERE p.embedding IS NULL
            ORDER BY p.id
            LIMIT :bs
        """), {"bs": batch_size}).fetchall()

    updated = skipped = errors = 0
    for row in rows:
        pid, name, desc, cat = row[0], row[1], row[2] or "", row[3] or ""
        tags = ""
        embed_text = _product_embed_text(name, desc, cat, tags)
        vec = _generate_embedding(embed_text, api_key)
        if vec is None:
            errors += 1
            continue
        try:
            db.execute(text("""
                UPDATE products SET embedding = :vec::vector
                WHERE id = :pid
            """), {"vec": _vec_str(vec), "pid": pid})
            db.commit()
            updated += 1
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save embedding for product #{pid}: {e}")
            errors += 1

    total = db.execute(text(
        "SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL"
    )).scalar() or 0

    return {
        "success": True,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "total_with_embeddings": total,
        "message": f"Generated {updated} embeddings ({errors} errors). {total} products indexed total.",
    }


def generate_single_product_embedding(db: Session, product_id: int) -> Dict[str, Any]:
    """Generate or refresh embedding for a single product."""
    return generate_product_embeddings_batch(db, product_ids=[product_id], batch_size=1)


def get_ai_analytics(db: Session, days: int = 30) -> Dict[str, Any]:
    """Admin analytics for AI usage and cost."""
    by_role = db.execute(text(f"""
        SELECT role, COUNT(*) as sessions, SUM(message_count),
               SUM(total_tokens_in), SUM(total_tokens_out), SUM(total_cost)
        FROM ai_sessions
        WHERE created_at >= NOW() - INTERVAL '{days} days'
        GROUP BY role
    """)).fetchall()

    daily = db.execute(text(f"""
        SELECT DATE(last_activity) as day, role, COUNT(*) as sessions,
               SUM(total_cost) as daily_cost
        FROM ai_sessions
        WHERE created_at >= NOW() - INTERVAL '{days} days'
        GROUP BY DATE(last_activity), role
        ORDER BY day
    """)).fetchall()

    total_cost = db.execute(text(
        f"SELECT COALESCE(SUM(total_cost), 0) FROM ai_sessions WHERE created_at >= NOW() - INTERVAL '{days} days'"
    )).scalar() or 0

    return {
        "period_days": days,
        "total_cost_usd": float(total_cost),
        "by_role": [
            {
                "role": r[0], "sessions": r[1],
                "messages": r[2] or 0,
                "tokens_in": r[3] or 0, "tokens_out": r[4] or 0,
                "cost_usd": float(r[5] or 0)
            }
            for r in by_role
        ],
        "daily_breakdown": [
            {"date": str(r[0]), "role": r[1], "sessions": r[2], "cost_usd": float(r[3] or 0)}
            for r in daily
        ]
    }
