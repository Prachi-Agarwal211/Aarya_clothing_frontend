"""Admin/staff chat — REST + WebSocket bridge.

Owns the support-chat surface used by the admin dashboard:
* REST endpoints for listing rooms/messages, posting replies, assigning, and
  closing rooms.
* WebSocket endpoints (`/api/v1/chat/ws/{room_id}` and
  `/api/v1/admin/chat/ws/{room_id}`) backed by a Redis Pub/Sub manager so
  multiple uvicorn workers stay in sync.

Customer-facing chat lives in the commerce service. This router is staff-only.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from shared.time_utils import now_ist
from typing import Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db, get_db_context
from schemas.admin import ChatMessageCreate
from shared.auth_middleware import require_staff

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat"])

_WORKER_ID = str(uuid.uuid4())[:8]


# ==================== REST ====================


@router.get("/api/v1/admin/chat/rooms")
async def list_chat_rooms(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    where, params = "", {}
    if status:
        where = "WHERE status = :status"
        params["status"] = status

    rows = db.execute(
        text(
            f"""
            SELECT cr.*,
                   COALESCE(
                       (SELECT COUNT(*) FROM chat_messages cm
                        WHERE cm.room_id = cr.id
                        AND cm.is_read = false
                        AND cm.sender_type IN ('customer', 'staff')),
                       0
                   ) as unread
            FROM chat_rooms cr
            {where}
            ORDER BY updated_at DESC
            LIMIT 50
            """
        ),
        params,
    ).fetchall()
    return {"rooms": [dict(r._mapping) for r in rows]}


@router.get("/api/v1/admin/chat/rooms/{room_id}/messages")
async def get_chat_messages(
    room_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    msgs = db.execute(
        text(
            "SELECT * FROM chat_messages WHERE room_id = :rid ORDER BY created_at ASC"
        ),
        {"rid": room_id},
    ).fetchall()
    db.execute(
        text(
            "UPDATE chat_messages SET is_read = true "
            "WHERE room_id = :rid AND sender_type NOT IN ('staff', 'admin')"
        ),
        {"rid": room_id},
    )
    db.commit()
    return {"messages": [dict(m._mapping) for m in msgs]}


@router.post("/api/v1/admin/chat/rooms/{room_id}/messages")
async def send_chat_message(
    room_id: int,
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    db.execute(
        text(
            "INSERT INTO chat_messages (room_id, sender_id, sender_type, message) "
            "VALUES (:rid, :sid, :st, :msg)"
        ),
        {
            "rid": room_id,
            "sid": user.get("user_id"),
            "st": data.sender_type,
            "msg": data.message,
        },
    )
    db.execute(
        text("UPDATE chat_rooms SET updated_at = :now WHERE id = :rid"),
        {"now": now_ist(), "rid": room_id},
    )
    db.commit()
    redis_client.publish(
        "chat:notifications",
        {"room_id": room_id, "message": data.message},
    )
    return {"message": "Message sent"}


@router.put("/api/v1/admin/chat/rooms/{room_id}/assign")
async def assign_chat_room(
    room_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    db.execute(
        text(
            "UPDATE chat_rooms SET assigned_to = :uid, status = 'assigned', "
            "updated_at = :now WHERE id = :rid"
        ),
        {"uid": user.get("user_id"), "rid": room_id, "now": now_ist()},
    )
    db.commit()
    return {"message": "Chat room assigned to you"}


@router.put("/api/v1/admin/chat/rooms/{room_id}/close")
async def close_chat_room(
    room_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    db.execute(
        text(
            "UPDATE chat_rooms SET status = 'closed', closed_at = :now, "
            "updated_at = :now WHERE id = :rid"
        ),
        {"rid": room_id, "now": now_ist()},
    )
    db.commit()
    return {"message": "Chat room closed"}


# ==================== WebSocket ====================


class ChatConnectionManager:
    """Per-room WebSocket fan-out backed by Redis Pub/Sub.

    Each worker keeps a list of local connections per room and a single
    background subscriber that relays messages from peer workers, tagged with
    a per-process ``_origin`` marker so we never echo our own messages.
    """

    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}
        self._subscribers: dict[int, asyncio.Task] = {}

    async def connect(self, room_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(room_id, []).append(ws)
        if room_id not in self._subscribers:
            self._subscribers[room_id] = asyncio.create_task(
                self._redis_subscriber(room_id)
            )

    def disconnect(self, room_id: int, ws: WebSocket):
        conns = self.active.get(room_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns and room_id in self._subscribers:
            self._subscribers[room_id].cancel()
            del self._subscribers[room_id]

    async def broadcast_local(self, room_id: int, message: dict):
        dead = []
        for ws in self.active.get(room_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room_id, ws)

    async def publish_to_redis(self, room_id: int, message: dict):
        try:
            payload = json.dumps({**message, "_origin": _WORKER_ID})
            redis_client.client.publish(f"chat:room:{room_id}", payload)
        except Exception as exc:
            logger.warning("Redis publish error for room %s: %s", room_id, exc)

    async def _redis_subscriber(self, room_id: int):
        pubsub = redis_client.client.pubsub()
        channel = f"chat:room:{room_id}"
        pubsub.subscribe(channel)
        try:
            while True:
                message = pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=0.1
                )
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    parsed = json.loads(data)
                    if parsed.get("_origin") != _WORKER_ID:
                        parsed.pop("_origin", None)
                        await self.broadcast_local(room_id, parsed)
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Redis subscriber error for room %s: %s", room_id, exc)
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()


chat_manager = ChatConnectionManager()


async def _save_chat_message_async(
    room_id: int, user_id: int, sender_type: str, msg_text: str
):
    """Persist a chat message in a short-lived session.

    Run as a background task so the WebSocket loop never waits on the DB.
    """
    from database.database import SessionLocal

    db_session = SessionLocal()
    try:
        db_session.execute(
            text(
                "INSERT INTO chat_messages (room_id, sender_id, sender_type, message) "
                "VALUES (:rid, :sid, :st, :msg)"
            ),
            {"rid": room_id, "sid": user_id, "st": sender_type, "msg": msg_text},
        )
        db_session.execute(
            text("UPDATE chat_rooms SET updated_at = :now WHERE id = :rid"),
            {"now": now_ist(), "rid": room_id},
        )
        db_session.commit()
    except Exception as exc:
        db_session.rollback()
        logger.error("WS chat DB error: %s", exc)
    finally:
        db_session.close()


async def _websocket_staff_chat(
    ws: WebSocket, room_id: int, token: Optional[str]
):
    """Shared handler for both staff WebSocket entry points.

    Customers connect via Commerce; this is for the admin dashboard. We resolve
    the token from cookies/query, verify room membership, then loop on receive.
    DB use is short-lived to keep PgBouncer pools healthy.
    """
    cookie_token = ws.cookies.get("access_token")
    resolved_token = cookie_token or token
    if not resolved_token:
        await ws.close(code=4001, reason="Missing token")
        return

    try:
        payload = pyjwt.decode(
            resolved_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("user_id")
        role = payload.get("role", "customer")
    except Exception:
        await ws.close(code=4003, reason="Invalid token")
        return

    sender_type = "staff" if role in ("admin", "staff", "superadmin") else "customer"

    try:
        with get_db_context() as db:
            room = db.execute(
                text("SELECT id, customer_id, status FROM chat_rooms WHERE id = :rid"),
                {"rid": room_id},
            ).fetchone()
            if not room:
                await ws.close(code=4004, reason="Room not found")
                return
            if sender_type == "customer" and room[1] != user_id:
                await ws.close(code=4003, reason="Forbidden")
                return
    except Exception as exc:
        logger.error("WebSocket room verification failed: %s", exc)
        await ws.close(code=4011, reason="Internal error")
        return

    await chat_manager.connect(room_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            msg_text = data.get("message", "").strip()
            if not msg_text:
                continue

            now = now_ist()
            message_payload = {
                "room_id": room_id,
                "sender_id": user_id,
                "sender_type": sender_type,
                "message": msg_text,
                "created_at": now.isoformat(),
            }

            await chat_manager.broadcast_local(room_id, message_payload)
            await chat_manager.publish_to_redis(room_id, message_payload)
            asyncio.create_task(
                _save_chat_message_async(room_id, user_id, sender_type, msg_text)
            )
    except WebSocketDisconnect:
        chat_manager.disconnect(room_id, ws)
    except Exception as exc:
        logger.error("WebSocket error room %s: %s", room_id, exc)
        chat_manager.disconnect(room_id, ws)


@router.websocket("/api/v1/chat/ws/{room_id}")
async def websocket_chat(ws: WebSocket, room_id: int, token: str = Query(None)):
    """Direct service entry point — handy for tests and internal tools."""
    await _websocket_staff_chat(ws, room_id, token)


@router.websocket("/api/v1/admin/chat/ws/{room_id}")
async def websocket_chat_admin_dashboard(
    ws: WebSocket, room_id: int, token: str = Query(None)
):
    """Path the admin dashboard hits (mirrored by the nginx ws location)."""
    await _websocket_staff_chat(ws, room_id, token)
