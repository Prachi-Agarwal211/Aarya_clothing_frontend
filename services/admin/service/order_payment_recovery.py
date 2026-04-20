"""Razorpay payment recovery: list captured payments vs DB orders, force-create order."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

import razorpay
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def payment_recovery_report(db: Session, from_timestamp: Optional[int]) -> dict:
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay credentials not configured")

    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        if not from_timestamp:
            from_timestamp = int(
                (datetime.now(timezone.utc) - timedelta(hours=48)).timestamp()
            )
        payments = client.payment.all(
            {
                "from": from_timestamp,
                "count": 100,
                "expand[]": "order",
            }
        )
        items = payments.get("items", [])
    except Exception as e:
        logger.error("Razorpay payment fetch failed: %s", e)
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch Razorpay payments: {e!s}"
        ) from e

    existing = set(
        row[0]
        for row in db.execute(
            text(
                "SELECT transaction_id FROM orders WHERE transaction_id IS NOT NULL"
            )
        ).fetchall()
    )

    matched = []
    missing_orders = []
    total_missing_amount = 0.0

    for payment in items:
        payment_id = payment.get("id", "")
        order_id = payment.get("order_id", "")
        amount_inr = payment.get("amount", 0) / 100
        pay_status = payment.get("status", "")
        if pay_status != "captured":
            continue
        if payment_id in existing or order_id in existing:
            matched.append(
                {
                    "payment_id": payment_id,
                    "order_id": order_id,
                    "amount": amount_inr,
                    "email": payment.get("email", ""),
                    "contact": payment.get("contact", ""),
                    "created_at": payment.get("created_at", 0),
                    "status": "matched",
                }
            )
        else:
            total_missing_amount += amount_inr
            missing_orders.append(
                {
                    "payment_id": payment_id,
                    "razorpay_order_id": order_id,
                    "amount": amount_inr,
                    "email": payment.get("email", ""),
                    "contact": payment.get("contact", ""),
                    "method": payment.get("method", ""),
                    "created_at": payment.get("created_at", 0),
                    "status": "missing_order",
                }
            )

    return {
        "from_timestamp": from_timestamp,
        "total_payments_fetched": len(items),
        "total_captured": len(matched) + len(missing_orders),
        "matched_count": len(matched),
        "missing_order_count": len(missing_orders),
        "total_missing_amount_inr": total_missing_amount,
        "matched": matched,
        "missing_orders": missing_orders,
    }


def force_create_order_from_payment(
    db: Session, payment_id: str, current_user: dict[str, Any]
) -> dict:
    payment_id = payment_id.strip()
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id is required")

    existing = db.execute(
        text(
            "SELECT id, invoice_number FROM orders WHERE transaction_id = :pid "
            "OR razorpay_payment_id = :pid"
        ),
        {"pid": payment_id},
    ).fetchone()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Order already exists for this payment: #{existing[0]} ({existing[1]})",
        )

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay credentials not configured")

    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        payment = client.payment.fetch(payment_id)
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch payment from Razorpay: {e!s}"
        ) from e

    if payment.get("status") != "captured":
        raise HTTPException(
            status_code=400,
            detail=f"Payment {payment_id} is not captured (status: {payment.get('status')})",
        )

    amount_inr = payment.get("amount", 0) / 100
    razorpay_order_id = payment.get("order_id") or ""
    customer_email = payment.get("email") or ""
    customer_contact = payment.get("contact") or ""
    method = payment.get("method") or "razorpay"

    user_row = None
    if customer_email:
        user_row = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": customer_email},
        ).fetchone()

    user_id = user_row[0] if user_row else 1

    addr_row = db.execute(
        text(
            """
            SELECT id, full_name, phone, address_line1, address_line2, city, state, postal_code
            FROM addresses
            WHERE user_id = :uid
            ORDER BY is_default DESC, id ASC
            LIMIT 1
            """
        ),
        {"uid": user_id},
    ).fetchone()

    shipping_address_id = None
    shipping_address_text = ""
    if addr_row:
        shipping_address_id = addr_row[0]
        parts = [addr_row[1], addr_row[3]]
        if addr_row[4]:
            parts.append(addr_row[4])
        parts += [addr_row[5], f"{addr_row[6]} {addr_row[7]}"]
        if addr_row[2]:
            parts.append(f"Ph: {addr_row[2]}")
        shipping_address_text = ", ".join(p for p in parts if p)
    elif customer_contact:
        shipping_address_text = (
            f"Contact: {customer_contact} — address to be collected"
        )

    max_inv = db.execute(text("SELECT MAX(id) FROM orders")).scalar() or 0
    next_id = max_inv + 1
    invoice_number = f"INV-2026-{str(next_id).zfill(6)}"

    notes = (
        f"RECOVERED by admin ({current_user.get('email', 'admin')}): "
        f"Force-created from Razorpay {payment_id} (Rs{amount_inr}). "
        f"Method: {method}. Contact: {customer_contact or 'N/A'}."
    )

    result = db.execute(
        text(
            """
            INSERT INTO orders (
                user_id, transaction_id, razorpay_order_id, razorpay_payment_id,
                status, total_amount, subtotal, payment_method,
                invoice_number, shipping_address_id, shipping_address, order_notes,
                created_at, updated_at
            ) VALUES (
                :user_id, :transaction_id, :razorpay_order_id, :payment_id,
                'confirmed', :amount, :amount, 'razorpay',
                :invoice_number, :addr_id, :shipping_address, :notes,
                NOW(), NOW()
            ) RETURNING id, invoice_number
            """
        ),
        {
            "user_id": user_id,
            "transaction_id": payment_id,
            "razorpay_order_id": razorpay_order_id,
            "payment_id": payment_id,
            "amount": amount_inr,
            "invoice_number": invoice_number,
            "addr_id": shipping_address_id,
            "shipping_address": shipping_address_text,
            "notes": notes,
        },
    )
    db.commit()
    row = result.fetchone()

    logger.info(
        "Admin force-created order #%s for payment %s by %s",
        row[0],
        payment_id,
        current_user.get("email"),
    )

    email_sent = False
    if customer_email:
        try:
            smtp_host = os.getenv("SMTP_HOST", "")
            smtp_port = int(os.getenv("SMTP_PORT", "465"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_pass = os.getenv("SMTP_PASSWORD", "")
            from_email = os.getenv("EMAIL_FROM", smtp_user)
            from_name = os.getenv("EMAIL_FROM_NAME", "Aarya Clothing")

            if smtp_host and smtp_user and smtp_pass:
                customer_name = (
                    addr_row[1]
                    if addr_row
                    else customer_email.split("@")[0].title()
                )
                subject = f"Order Confirmed! {invoice_number} - Aarya Clothing"
                html_body = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#0B0608;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#180F14;border-radius:20px;padding:40px;">
  <h2 style="color:#F2C29A;">Order Confirmed</h2>
  <p style="color:#EAE0D5;">Dear {customer_name}, your order {invoice_number} is confirmed.</p>
  <p style="color:#4ade80;font-size:20px;">₹{amount_inr:.0f}</p>
  <p style="color:#EAE0D5;">{shipping_address_text or ''}</p>
</div>
</body></html>"""
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{from_name} <{from_email}>"
                msg["To"] = customer_email
                msg.attach(MIMEText(html_body, "html"))
                ctx = ssl.create_default_context()
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx, timeout=20) as srv:
                    srv.login(smtp_user, smtp_pass)
                    srv.sendmail(from_email, customer_email, msg.as_string())
                email_sent = True
        except Exception as email_err:
            logger.warning("Confirmation email failed for %s: %s", customer_email, email_err)

    return {
        "success": True,
        "order_id": row[0],
        "invoice_number": row[1],
        "payment_id": payment_id,
        "amount": amount_inr,
        "customer_email": customer_email,
        "shipping_address": shipping_address_text,
        "email_sent": email_sent,
        "message": f"Order #{row[0]} created successfully"
        + (" — confirmation email sent" if email_sent else ""),
    }
