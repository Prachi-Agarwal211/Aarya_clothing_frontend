"""
Super-admin AI dashboard endpoints.

Read-only data tools (sales, inventory, customers, orders, revenue, top
products, AI insights) plus the approval queue for AI-suggested actions.
Mutations always require super_admin and are written to the audit log.
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.database import get_db
from service.permissions_service import (
    has_permission,
    log_audit_action,
    get_pending_actions,
    approve_pending_action,
    reject_pending_action,
)
from service.ai_dashboard_tools import (
    _dashboard_tools,
    _execute_dashboard_tool,
    _get_ai_insights,
)
from shared.auth_middleware import require_super_admin
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/api/v1/admin/ai-dashboard/tools",
    tags=["AI Dashboard"],
    summary="Get available AI dashboard tools",
)
async def get_ai_dashboard_tools(
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """Return the catalog of dashboard query tools the AI can call."""
    tools = _dashboard_tools()
    return {"tools": tools, "count": len(tools)}


@router.post(
    "/api/v1/admin/ai-dashboard/query",
    tags=["AI Dashboard"],
    summary="Execute AI dashboard query",
)
async def execute_ai_dashboard_query(
    request: Dict[str, Any],
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """Execute a dashboard query tool by name with optional args."""
    tool_name = request.get("tool")
    args = request.get("args", {})

    if not tool_name:
        raise HTTPException(status_code=400, detail="Tool name required")

    # super_admin bypasses granular permission checks; everyone else needs
    # the explicit ai_dashboard:view grant.
    if user.get("role") != "super_admin" and not has_permission(
        db, user["sub"], "ai_dashboard", "view"
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = _execute_dashboard_tool(db, tool_name, args)

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="VIEW",
        module="ai_dashboard",
        description=f"Executed AI dashboard query: {tool_name}",
        ip_address=user.get("ip"),
        metadata={"tool": tool_name, "args": args},
    )

    return {"result": result}


@router.get(
    "/api/v1/admin/ai-dashboard/insights",
    tags=["AI Dashboard"],
    summary="Get AI business insights",
)
async def get_ai_business_insights(
    focus_area: str = Query("all", regex="^(sales|inventory|customers|orders|all)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """Return AI-generated insights and recommendations for a focus area."""
    import json

    insights_result = _get_ai_insights(db, {"focus_area": focus_area})
    return json.loads(insights_result)


@router.get(
    "/api/v1/admin/ai-dashboard/pending-actions",
    tags=["AI Dashboard"],
    summary="Get pending AI actions",
)
async def get_ai_pending_actions(
    status: str = Query("pending", regex="^(pending|approved|rejected|executed)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """List AI-proposed actions in the requested lifecycle state."""
    actions = get_pending_actions(db, status)
    return {
        "actions": [
            {
                "id": a.id,
                "session_id": a.session_id,
                "action_type": a.action_type,
                "params": a.params,
                "status": a.status,
                "created_at": a.created_at,
                "reviewed_at": a.reviewed_at,
                "rejection_reason": a.rejection_reason,
            }
            for a in actions
        ],
        "count": len(actions),
    }


@router.post(
    "/api/v1/admin/ai-dashboard/pending-actions/{action_id}/approve",
    tags=["AI Dashboard"],
    summary="Approve pending AI action",
)
async def approve_ai_action(
    action_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """Approve a pending AI action and execute it under the approver's identity."""
    from service.ai_service import execute_confirmed_action

    action = approve_pending_action(db, action_id, user["sub"])

    result = execute_confirmed_action(
        db=db,
        action_type=action.action_type,
        params=action.params,
        admin_user_id=user["sub"],
    )

    action.status = "executed"
    action.executed_at = now_ist()
    db.commit()

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="APPROVE",
        module="ai_dashboard",
        description=f"Approved and executed AI action: {action.action_type}",
        ip_address=user.get("ip"),
        metadata={"action_id": action_id, "result": result},
    )

    return {"success": True, "action": action.action_type, "result": result}


@router.post(
    "/api/v1/admin/ai-dashboard/pending-actions/{action_id}/reject",
    tags=["AI Dashboard"],
    summary="Reject pending AI action",
)
async def reject_ai_action(
    action_id: int,
    reason: str = Query(..., min_length=5),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    """Reject a pending AI action with a required justification."""
    action = reject_pending_action(db, action_id, user["sub"], reason)

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="REJECT",
        module="ai_dashboard",
        description=f"Rejected AI action: {action.action_type}",
        ip_address=user.get("ip"),
        metadata={"action_id": action_id, "reason": reason},
    )

    return {"success": True, "action_id": action_id, "status": "rejected"}
