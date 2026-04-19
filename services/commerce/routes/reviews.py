"""
Product reviews router.

Owns the customer-facing review surface (create, list, mark helpful, delete,
upload image) plus the single staff endpoint for moderation. The image upload
is rate-limited and validated up front so we never hand a junk file to R2.
"""
from __future__ import annotations

import logging
import uuid
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from database.database import get_db
from rate_limit import check_rate_limit
from schemas.review import ReviewCreate, ReviewResponse
from service.r2_service import r2_service
from service.review_service import ReviewService
from shared.auth_middleware import get_current_user, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Reviews"])

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post(
    "/api/v1/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a product review for the authenticated user."""
    review_service = ReviewService(db)
    return review_service.create_review(
        current_user["user_id"],
        product_id=review_data.product_id,
        rating=review_data.rating,
        title=review_data.title,
        comment=review_data.comment,
        order_id=review_data.order_id,
        image_urls=review_data.image_urls or [],
    )


@router.post("/api/v1/reviews/upload-image")
async def upload_review_image(
    request: Request,
    file: UploadFile = File(..., description="Review image file"),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a single image for a review and return its public R2 URL.

    Accepts JPG, PNG, or WebP up to 5 MB. Capped at 10 uploads per minute
    per user to keep abuse off the bucket.
    """
    if not check_rate_limit(
        request,
        "review_upload",
        limit=10,
        window=60,
        user_identifier=str(current_user["user_id"]),
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many image uploads. Please wait before uploading more images.",
        )

    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed types: JPG, PNG, WebP",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB",
        )

    try:
        ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
        unique_name = f"review_{current_user['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
        image_url = await r2_service.upload_image(
            file,
            folder="reviews",
            custom_filename=unique_name,
        )
        return {"url": image_url, "filename": unique_name, "size": file_size}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Review image upload failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {exc}",
        )


@router.get(
    "/api/v1/products/{product_id}/reviews",
    response_model=List[ReviewResponse],
)
async def get_product_reviews(
    product_id: int,
    approved_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List reviews for a product (defaults to approved-only for the storefront)."""
    review_service = ReviewService(db)
    return review_service.get_product_reviews(
        product_id,
        approved_only=approved_only,
        skip=skip,
        limit=limit,
    )


@router.post("/api/v1/reviews/{review_id}/helpful")
async def mark_review_helpful(review_id: int, db: Session = Depends(get_db)):
    """Increment the helpful count for a review (anonymous, idempotent on the client)."""
    review_service = ReviewService(db)
    review_service.mark_helpful(review_id)
    return {"message": "Review marked as helpful"}


@router.delete(
    "/api/v1/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a review you own."""
    review_service = ReviewService(db)
    review_service.delete_review(review_id, current_user["user_id"])
    return


@router.post(
    "/api/v1/admin/reviews/{review_id}/approve",
    response_model=ReviewResponse,
    tags=["Admin - Reviews"],
)
async def approve_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    """Approve a queued review so it shows on the product page."""
    review_service = ReviewService(db)
    return review_service.approve_review(review_id)
