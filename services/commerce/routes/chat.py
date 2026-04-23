"""
Customer chat router.

Owns the customer-facing side of support chat:
* WebSocket endpoint at /api/v1/chat/ws/{room_id}
* REST endpoints to create/list rooms and send/list messages

The matching admin/staff side lives in services/admin/routes/staff_management.py.
Cross-worker WebSocket fan-out is done via Redis pub/sub so multiple uvicorn
workers can serve the same room.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, List, Optional

from shared.time_utils import now_ist

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from database.database import get_db, get_db_context
from shared.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Customer Chat"])


class ChatConnectionManager:
    """
    WebSocket connection manager with Redis pub/sub for cross-worker broadcast.

    Without Redis pub/sub, messages only reach clients connected to the SAME
    uvicorn worker. With UVICORN_WORKERS>1 this breaks real-time chat when
    staff and customer land on different workers.
    """

    def __init__(self) -> None:
        self.active_connections: dict[int, List[WebSocket]] = {}
        self._pubsub_task: Optional[asyncio.Task] = None
        self._redis_sub: Any = None

    async def connect(self, websocket: WebSocket, room_id: int) -> None:
        await websocket.accept()
        self.active_connections.setdefault(room_id, []).append(websocket)
        if self._pubsub_task is None or self._pubsub_task.done():
            self._pubsub_task = asyncio.create_task(self._redis_subscribe_loop())

    def disconnect(self, websocket: WebSocket, room_id: int) -> None:
        conns = self.active_connections.get(room_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            del self.active_connections[room_id]

    async def broadcast_local(self, message: dict, room_id: int) -> None:
        """Broadcast to local WebSocket connections only (same worker)."""
        for connection in self.active_connections.get(room_id, []):
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.error(f"WebSocket send error: {exc}")

    async def broadcast(self, message: dict, room_id: int) -> None:
        """Broadcast locally AND publish to Redis for other workers."""
        await self.broadcast_local(message, room_id)
        await self._redis_publish(room_id, message)

    async def _redis_publish(self, room_id: int, message: dict) -> None:
        try:
            from core.redis_client import redis_client

            channel = f"chat:room:{room_id}"
            redis_client.client.publish(channel, json.dumps(message, default=str))
        except Exception as exc:
            logger.warning(f"[Chat] Redis publish failed for room {room_id}: {exc}")

    async def _redis_subscribe_loop(self) -> None:
        """Subscribe to all chat room channels and relay to local connections."""
        try:
            from core.redis_client import redis_client

            pubsub = redis_client.client.pubsub()
            pubsub.psubscribe("chat:room:*")
            self._redis_sub = pubsub
            logger.info("[Chat] Redis pub/sub subscriber started")

            while True:
                try:
                    message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                    if message and message["type"] == "message":
                        data = json.loads(message["data"])
                        room_id = data.get("room_id")
                        if room_id and room_id in self.active_connections:
                            await self.broadcast_local(data, room_id)
                    await asyncio.sleep(0)
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.warning(f"[Chat] Redis subscribe error: {exc}")
                    await asyncio.sleep(0.5)
        except Exception as exc:
            logger.error(f"[Chat] Failed to start Redis subscriber: {exc}")


chat_manager = ChatConnectionManager()


@router.websocket("/api/v1/chat/ws/{room_id}")
async def websocket_chat(
    websocket: WebSocket, room_id: int, token: Optional[str] = Query(None)
) -> None:
    """
    WebSocket endpoint for real-time customer support chat.

    Auth precedence: HttpOnly access_token cookie -> ?token= query param.
    Token-in-URL is deprecated (leaks into access logs) but still accepted as
    a fallback for older clients.
    """
    cookie_token = websocket.cookies.get("access_token")
    resolved_token = cookie_token or token

    user = None
    if resolved_token:
        try:
            from shared.auth_middleware import auth_middleware

            if auth_middleware:
                payload = auth_middleware.decode_token(resolved_token)
                user = auth_middleware.extract_user_info(payload)
        except Exception as exc:
            logger.warning(f"WebSocket auth failed: {exc}")

    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = user.get("user_id")
    is_staff = user.get("is_staff", False) or user.get("is_admin", False)

    try:
        with get_db_context() as db:
            room = db.execute(
                text("SELECT id, status FROM chat_rooms WHERE id = :rid"),
                {"rid": room_id},
            ).fetchone()
            if not room:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

            if not is_staff:
                owner = db.execute(
                    text("SELECT customer_id FROM chat_rooms WHERE id = :rid"),
                    {"rid": room_id},
                ).scalar()
                if owner != user_id:
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    return
    except Exception as exc:
        logger.error(f"WebSocket room verification failed: {exc}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    await chat_manager.connect(websocket, room_id)
    try:
        while True:
            raw = await websocket.receive_json()
            msg_text = (
                raw.get("message", "").strip() if isinstance(raw, dict) else str(raw).strip()
            )
            if not msg_text:
                continue

            sender_type = "admin" if is_staff else "customer"

            def _save_message() -> None:
                try:
                    with get_db_context() as db:
                        db.execute(
                            text(
                                "INSERT INTO chat_messages (room_id, sender_id, sender_type, message)"
                                " VALUES (:rid, :sid, :stype, :msg)"
                            ),
                            {"rid": room_id, "sid": user_id, "stype": sender_type, "msg": msg_text},
                        )
                        db.execute(
                            text("UPDATE chat_rooms SET updated_at = NOW() WHERE id = :rid"),
                            {"rid": room_id},
                        )
                        db.commit()
                except Exception as exc:
                    logger.error(f"Failed to save chat message: {exc}")
                    raise

            await run_in_threadpool(_save_message)

            payload = {
                "room_id": room_id,
                "sender_id": user_id,
                "sender_type": sender_type,
                "message": msg_text,
                "created_at": now_ist().isoformat(),
            }
            await chat_manager.broadcast(payload, room_id)

    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, room_id)
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}")
        chat_manager.disconnect(websocket, room_id)


@router.post("/api/v1/chat/rooms")
async def create_chat_room(
    subject: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new chat room for customer support."""
    user_id = current_user["user_id"]

    existing = db.execute(
        text(
            "SELECT id FROM chat_rooms"
            " WHERE customer_id = :uid AND status IN ('open', 'assigned') LIMIT 1"
        ),
        {"uid": user_id},
    ).fetchone()
    if existing:
        return {"room_id": existing[0], "message": "You already have an open chat"}

    result = db.execute(
        text(
            "INSERT INTO chat_rooms (customer_id, customer_name, customer_email, subject, order_id, status)"
            " VALUES (:uid, :name, :email, :subject, :oid, 'open') RETURNING id"
        ),
        {
            "uid": user_id,
            "name": current_user.get("username"),
            "email": current_user.get("email"),
            "subject": subject,
            "oid": order_id,
        },
    )
    room_id = result.scalar()

    db.execute(
        text(
            "INSERT INTO chat_messages (room_id, sender_type, message)"
            " VALUES (:rid, 'system', 'Welcome! A team member will be with you shortly.')"
        ),
        {"rid": room_id},
    )
    db.commit()

    return {"room_id": room_id, "message": "Chat room created"}


@router.get("/api/v1/chat/rooms/mine")
async def get_my_chat_rooms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return all chat rooms owned by the current customer."""
    user_id = current_user["user_id"]
    rows = db.execute(
        text("SELECT * FROM chat_rooms WHERE customer_id = :uid ORDER BY updated_at DESC"),
        {"uid": user_id},
    ).fetchall()
    return {"rooms": [dict(r._mapping) for r in rows]}


@router.get("/api/v1/chat/rooms/{room_id}/messages")
async def get_my_chat_messages(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return messages in a chat room (customer view)."""
    user_id = current_user["user_id"]

    room = db.execute(
        text("SELECT id FROM chat_rooms WHERE id = :rid AND customer_id = :uid"),
        {"rid": room_id, "uid": user_id},
    ).fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")

    msgs = db.execute(
        text("SELECT * FROM chat_messages WHERE room_id = :rid ORDER BY created_at ASC"),
        {"rid": room_id},
    ).fetchall()
    return {"messages": [dict(m._mapping) for m in msgs]}


@router.post("/api/v1/chat/rooms/{room_id}/messages")
async def send_customer_message(
    room_id: int,
    message: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Send a message in a chat room (customer side)."""
    user_id = current_user["user_id"]

    room = db.execute(
        text("SELECT id, status FROM chat_rooms WHERE id = :rid AND customer_id = :uid"),
        {"rid": room_id, "uid": user_id},
    ).fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    if room[1] == "closed":
        raise HTTPException(status_code=400, detail="Chat room is closed")

    db.execute(
        text(
            "INSERT INTO chat_messages (room_id, sender_id, sender_type, message)"
            " VALUES (:rid, :sid, 'customer', :msg)"
        ),
        {"rid": room_id, "sid": user_id, "msg": message},
    )
    db.execute(
        text("UPDATE chat_rooms SET updated_at = NOW() WHERE id = :rid"),
        {"rid": room_id},
    )
    db.commit()
    return {"message": "Message sent"}
