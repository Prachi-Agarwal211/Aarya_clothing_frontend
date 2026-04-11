"""Payloads for Commerce → Core internal notification API (transactional email)."""

from typing import Optional
from pydantic import BaseModel, Field


class OrderConfirmationNotify(BaseModel):
    to_email: str
    customer_name: str
    order_number: str
    order_items: str = ""
    subtotal: str = "0"
    shipping: str = "0"
    gst: str = "0"
    total: str = "0"
    discount_row: str = ""
    shipping_address: str = ""
    payment_method: str = ""
    estimated_delivery: str = ""
    track_order_url: str = ""


class OrderShippedNotify(BaseModel):
    to_email: str
    customer_name: str
    order_number: str
    tracking_number: str
    shipping_carrier: str = "Standard Shipping"
    estimated_delivery: str = ""
    track_order_url: str = ""


class OrderDeliveredNotify(BaseModel):
    to_email: str
    customer_name: str
    order_number: str
    delivery_date: str
    order_details_url: str
    review_url: str = ""


class OrderCancelledNotify(BaseModel):
    to_email: str
    customer_name: str
    order_number: str
    cancellation_date: str
    reason: str = ""
    refund_info: str = "Refund will be processed within 5-7 business days."
    shop_url: str = ""
