"""
Returns and exchanges router.

Customer and exchange flows share this module (same ``return_requests`` table).

Admin list/approve/reject/receive/refund lives in ``services/admin/routes/returns.py``
(nginx ``/api/v1/admin/*`` → admin).
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from models.inventory import Inventory
from models.product import Product
from models.return_request import ReturnStatus
from schemas.return_request import (
    ReturnRequestCreate,
    ReturnRequestResponse,
)
from service.r2_service import r2_service
from service.return_service import ReturnService
from shared.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Returns"])


# ---------------------------------------------------------------------------
# Customer-side returns
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/returns",
    response_model=ReturnRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_return_request(
    return_data: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """File a return request against one of your existing orders."""
    return_service = ReturnService(db)
    return return_service.create_return(current_user["user_id"], return_data)


@router.post(
    "/api/v1/returns/upload-video",
    status_code=status.HTTP_201_CREATED,
)
async def upload_return_video(
    file: UploadFile = File(..., description="Video file for return evidence"),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a video to a return request as evidence.

    Accepts mp4, mov, or webm up to 50 MB. Validation is owned by
    ``r2_service.upload_video`` so the same rules apply everywhere.
    """
    try:
        video_url = await r2_service.upload_video(file, folder="returns")
        return {"video_url": video_url, "message": "Video uploaded successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload video: {exc}",
        )


@router.get("/api/v1/returns", response_model=List[ReturnRequestResponse])
async def list_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List the authenticated user's return requests."""
    return_service = ReturnService(db)
    return return_service.get_user_returns(
        current_user["user_id"], skip=skip, limit=limit
    )


@router.get(
    "/api/v1/returns/{return_id}",
    response_model=ReturnRequestResponse,
)
async def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch a single return request, scoped to the authenticated user."""
    return_service = ReturnService(db)
    return_request = return_service.get_return_by_id(
        return_id, user_id=current_user["user_id"]
    )
    if not return_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Return request not found",
        )
    return return_request


@router.post(
    "/api/v1/returns/{return_id}/cancel",
    response_model=ReturnRequestResponse,
)
async def cancel_return_request(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cancel a return request you own. Only valid while still in 'requested'."""
    return_service = ReturnService(db)
    return_request = return_service.get_return_by_id(
        return_id, user_id=current_user["user_id"]
    )

    if not return_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Return request not found",
        )

    if return_request.status != ReturnStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only cancel return requests with 'requested' status",
        )

    db.delete(return_request)
    db.commit()
    return {"message": "Return request cancelled successfully", "id": return_id}


# ---------------------------------------------------------------------------
# Exchange flow
# ---------------------------------------------------------------------------

@router.post("/api/v1/returns/{return_id}/exchange")
async def request_exchange(
    return_id: int,
    exchange_product_id: int,
    exchange_variant_id: Optional[int] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Convert a 'requested' or 'approved' return into an exchange.

    Validates that:
    * The return belongs to the caller.
    * The exchange product (and variant, when provided) exists and is active.
    * There is stock left on the exchange SKU.
    * The exchange item value isn't drastically lower than the original
      (within 20%) so we don't accidentally refund value as inventory.

    On success the return description is annotated with the exchange details.
    """
    user_id = current_user["user_id"]

    ret = db.execute(
        text("SELECT id, status, user_id, order_id FROM return_requests WHERE id = :rid"),
        {"rid": return_id},
    ).fetchone()

    if not ret:
        raise HTTPException(status_code=404, detail="Return request not found")
    if ret[2] != user_id:
        raise HTTPException(status_code=403, detail="Not your return request")
    if ret[1] not in ("requested", "approved"):
        raise HTTPException(
            status_code=400,
            detail="Return cannot be converted to exchange",
        )

    product = (
        db.query(Product)
        .filter(Product.id == exchange_product_id, Product.is_active == True)  # noqa: E712
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Exchange product not found")

    if exchange_variant_id:
        variant = (
            db.query(Inventory)
            .filter(
                Inventory.id == exchange_variant_id,
                Inventory.product_id == exchange_product_id,
                Inventory.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not variant:
            raise HTTPException(
                status_code=404,
                detail="Exchange variant not found or doesn't belong to product",
            )
        available = (variant.quantity or 0) - (variant.reserved_quantity or 0)
        if available <= 0:
            raise HTTPException(
                status_code=400,
                detail="Exchange variant is out of stock",
            )
    else:
        total = db.execute(
            text(
                "SELECT COALESCE(SUM(quantity - reserved_quantity), 0) "
                "FROM inventory WHERE product_id = :pid AND is_active = true"
            ),
            {"pid": exchange_product_id},
        ).scalar()
        if (total or 0) <= 0:
            raise HTTPException(
                status_code=400,
                detail="Exchange product is out of stock",
            )

    order_id = ret[3]
    original_items = db.execute(
        text(
            "SELECT product_id, inventory_id, unit_price "
            "FROM order_items WHERE order_id = :oid"
        ),
        {"oid": order_id},
    ).fetchall()

    if original_items:
        if exchange_variant_id:
            row = db.execute(
                text(
                    "SELECT COALESCE(variant_price, 0) FROM inventory "
                    "WHERE id = :vid AND product_id = :pid"
                ),
                {"vid": exchange_variant_id, "pid": exchange_product_id},
            ).fetchone()
            exchange_price = (
                float(row[0]) if row and row[0] else float(product.base_price or 0)
            )
        else:
            exchange_price = float(product.base_price or 0)

        original_price = sum(float(item[2]) for item in original_items)

        if exchange_price < original_price * 0.8:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Exchange item value too low. Original: ${original_price:.2f}, "
                    f"Exchange: ${exchange_price:.2f}"
                ),
            )

    db.execute(
        text(
            "UPDATE return_requests "
            "SET description = CONCAT(COALESCE(description, ''), "
            "' | Exchange to product #', :pid, '. ', :notes) "
            "WHERE id = :rid"
        ),
        {"pid": exchange_product_id, "notes": notes or "", "rid": return_id},
    )
    db.commit()
    return {
        "message": "Exchange request submitted",
        "return_id": return_id,
        "exchange_product_id": exchange_product_id,
    }
