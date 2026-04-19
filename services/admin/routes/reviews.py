"""Admin reviews moderation — list, approve, reject, delete."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from core.redis_client import redis_client
from shared.auth_middleware import require_admin
from shared.time_utils import now_ist

router = APIRouter()


@router.get("/api/v1/admin/reviews", tags=["Admin Reviews"])
async def admin_list_reviews(
    product_id: Optional[int] = None,
    is_approved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List reviews, optionally filtered by product and approval state."""
    where_parts = []
    params = {"limit": limit, "skip": skip}
    if product_id:
        where_parts.append("r.product_id = :product_id")
        params["product_id"] = product_id
    if is_approved is not None:
        where_parts.append("r.is_approved = :approved")
        params["approved"] = is_approved
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    rows = db.execute(
        text(
            f"""
            SELECT r.id, r.product_id, r.user_id, r.rating, r.comment,
                   r.is_approved, r.created_at,
                   p.name as product_name,
                   u.username as customer_username, u.email as customer_email
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            LEFT JOIN users u ON r.user_id = u.id
            {where_clause}
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :skip
            """
        ),
        params,
    ).fetchall()

    reviews = [
        {
            "id": r[0], "product_id": r[1], "user_id": r[2], "rating": r[3],
            "comment": r[4], "is_approved": r[5], "created_at": r[6],
            "product_name": r[7], "customer_username": r[8], "customer_email": r[9],
        }
        for r in rows
    ]
    return {"reviews": reviews, "total": len(reviews)}


def _set_review_approval(db: Session, review_id: int, approved: bool) -> int:
    """Flip a review's `is_approved` flag and bust the products cache."""
    result = db.execute(
        text(
            "UPDATE reviews SET is_approved = :approved, updated_at = :now "
            "WHERE id = :id RETURNING id"
        ),
        {"id": review_id, "approved": approved, "now": now_ist().replace(tzinfo=None)},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Review not found")
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return review_id


@router.patch("/api/v1/admin/reviews/{review_id}/approve", tags=["Admin Reviews"])
async def admin_approve_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Approve a review so it appears on the storefront."""
    _set_review_approval(db, review_id, True)
    return {"message": "Review approved", "review_id": review_id}


@router.patch("/api/v1/admin/reviews/{review_id}/reject", tags=["Admin Reviews"])
async def admin_reject_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reject (un-approve) a review so it no longer appears on the storefront."""
    _set_review_approval(db, review_id, False)
    return {"message": "Review rejected", "review_id": review_id}


@router.delete(
    "/api/v1/admin/reviews/{review_id}",
    status_code=204,
    tags=["Admin Reviews"],
)
async def admin_delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Permanently delete a review."""
    result = db.execute(
        text("DELETE FROM reviews WHERE id = :id RETURNING id"),
        {"id": review_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Review not found")
    db.commit()
    redis_client.invalidate_pattern("products:*")
