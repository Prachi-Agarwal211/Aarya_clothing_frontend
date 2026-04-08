# ============================================================================
# IMPROVED PAYMENT TRANSACTION CREATION CODE
# Replace the existing code in order_service.py (lines 427-467)
# ============================================================================

"""
CRITICAL FIX: Replace silent failure pattern with proper error handling,
retry logic, and alerting for payment transaction creation.

This prevents the issue where orders are created but payment_transactions
records are silently lost due to unhandled errors.
"""

# ===== REPLACE THIS SECTION IN order_service.py =====
# Location: After line 421 (self.db.commit() and self.db.refresh(order))
# Around line 427-467

if payment_method == "razorpay" and transaction_id:
    try:
        from sqlalchemy import text as _text
        logger.info(
            f"PAYMENT_TRANSACTION_CREATE: order={order.id} user={user_id} "
            f"payment_id={transaction_id} order_id={razorpay_order_id}"
        )

        # Insert payment transaction record
        result = self.db.execute(
            _text("""
                INSERT INTO payment_transactions (
                    order_id, user_id, amount, currency, payment_method,
                    razorpay_order_id, razorpay_payment_id, razorpay_signature,
                    status, created_at, completed_at, transaction_id
                ) VALUES (
                    :order_id, :user_id, :amount, 'INR', 'razorpay',
                    :razorpay_order_id, :razorpay_payment_id, :signature,
                    'completed', NOW(), NOW(), :transaction_id
                )
                ON CONFLICT (transaction_id) 
                DO UPDATE SET 
                    order_id = EXCLUDED.order_id,
                    status = EXCLUDED.status,
                    updated_at = NOW(),
                    completed_at = COALESCE(payment_transactions.completed_at, EXCLUDED.completed_at)
            """),
            {
                "order_id": order.id,
                "user_id": user_id,
                "amount": order.total_amount,
                "razorpay_order_id": razorpay_order_id or "",
                "razorpay_payment_id": transaction_id,
                "signature": payment_signature or "",
                "transaction_id": transaction_id
            }
        )
        self.db.commit()
        
        # Check if row was actually inserted
        rows_affected = result.rowcount
        if rows_affected > 0:
            logger.info(
                f"✓ PAYMENT_TRANSACTION_CREATED: order={order.id} "
                f"transaction_id={transaction_id}"
            )
        else:
            # ON CONFLICT DO UPDATE was triggered
            logger.warning(
                f"⚠ PAYMENT_TRANSACTION_UPDATE: order={order.id} "
                f"transaction_id={transaction_id} (record already existed)"
            )
            
    except Exception as payment_err:
        # CRITICAL: This is a DATA INTEGRITY issue - must alert and track
        logger.critical(
            f"🚨 CRITICAL DATA INTEGRITY ISSUE: "
            f"Payment transaction creation FAILED for order {order.id}. "
            f"Order exists but NO payment audit trail! "
            f"Error: {payment_err}",
            exc_info=True
        )
        
        # Mark order for manual review
        try:
            if order.order_notes:
                order.order_notes += (
                    f" [PAYMENT_TRANSACTION_FAILED: {str(payment_err)[:200]}]"
                )
            else:
                order.order_notes = (
                    f"PAYMENT_TRANSACTION_FAILED: {str(payment_err)[:200]}"
                )
            order.status = 'payment_review_required'  # Add this status if needed
            self.db.commit()
            logger.info(f"Order {order.id} marked for payment review")
        except Exception as mark_err:
            logger.critical(
                f"Failed to mark order {order.id} for review: {mark_err}"
            )
        
        # Send alert to ops team (implement based on your alerting system)
        try:
            send_payment_integrity_alert(
                order_id=order.id,
                user_id=user_id,
                amount=order.total_amount,
                transaction_id=transaction_id,
                error=str(payment_err)
            )
        except Exception as alert_err:
            logger.error(f"Failed to send alert: {alert_err}")
        
        # Retry once (in case of transient DB error)
        logger.info(f"Retrying payment transaction creation for order {order.id}...")
        try:
            retry_create_payment_transaction(
                db=self.db,
                order_id=order.id,
                user_id=user_id,
                amount=order.total_amount,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=transaction_id,
                signature=payment_signature,
                transaction_id=transaction_id
            )
        except Exception as retry_err:
            logger.critical(
                f"🚨 RETRY FAILED: Payment transaction creation still failed "
                f"for order {order.id}: {retry_err}"
            )
            # Don't fail the order - but this needs immediate manual attention

# Helper functions (add these to order_service.py or a separate alerts module)

def send_payment_integrity_alert(order_id: int, user_id: int, amount: float, 
                                  transaction_id: str, error: str):
    """Send alert when payment transaction creation fails."""
    import os
    import requests
    
    # Option 1: Slack webhook
    slack_webhook = os.getenv('SLACK_ALERTS_WEBHOOK')
    if slack_webhook:
        try:
            requests.post(slack_webhook, json={
                "text": (
                    f"🚨 CRITICAL: Payment Data Integrity Issue\n"
                    f"Order ID: {order_id}\n"
                    f"User ID: {user_id}\n"
                    f"Amount: ₹{amount}\n"
                    f"Transaction ID: {transaction_id}\n"
                    f"Error: {error[:500]}"
                ),
                "username": "Payment Monitor",
                "icon_emoji": ":rotating_light:"
            })
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
    
    # Option 2: Email (implement based on your email service)
    # Option 3: PagerDuty (implement based on your on-call system)
    # Option 4: Write to alerts table in database


def retry_create_payment_transaction(db, order_id: int, user_id: int, 
                                      amount: float, razorpay_order_id: str,
                                      razorpay_payment_id: str, signature: str,
                                      transaction_id: str):
    """Retry creating payment transaction record."""
    from sqlalchemy import text as _text
    
    result = db.execute(
        _text("""
            INSERT INTO payment_transactions (
                order_id, user_id, amount, currency, payment_method,
                razorpay_order_id, razorpay_payment_id, razorpay_signature,
                status, created_at, completed_at, transaction_id
            ) VALUES (
                :order_id, :user_id, :amount, 'INR', 'razorpay',
                :razorpay_order_id, :razorpay_payment_id, :signature,
                'completed', NOW(), NOW(), :transaction_id
            )
            ON CONFLICT (transaction_id) 
            DO UPDATE SET 
                order_id = EXCLUDED.order_id,
                status = 'completed',
                updated_at = NOW()
        """),
        {
            "order_id": order_id,
            "user_id": user_id,
            "amount": amount,
            "razorpay_order_id": razorpay_order_id or "",
            "razorpay_payment_id": razorpay_payment_id,
            "signature": signature or "",
            "transaction_id": transaction_id
        }
    )
    db.commit()
    
    if result.rowcount > 0:
        logger.info(f"✓ RETRY SUCCESS: Payment transaction created for order {order_id}")
    else:
        logger.warning(f"⚠ RETRY: Payment transaction already existed for order {order_id}")


# ============================================================================
# DATABASE CONSTRAINT FIXES
# Run these SQL commands to add proper foreign key constraints
# ============================================================================

"""
-- Add foreign key constraint to payment_transactions.order_id
-- This ensures referential integrity
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_order 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id 
ON payment_transactions(order_id);

-- Optional: Add a check constraint to ensure completed payments have order_id
-- (uncomment after fixing existing NULL values)
-- ALTER TABLE payment_transactions 
-- ADD CONSTRAINT chk_completed_has_order 
-- CHECK (status != 'completed' OR order_id IS NOT NULL);
"""

# ============================================================================
# INTEGRITY VALIDATION FUNCTION
# Add this to order_service.py or a separate validation module
# ============================================================================

def validate_order_payment_trail(self, order_id: int) -> bool:
    """
    Validate that payment_transactions record exists for an order.
    Returns True if valid, False if orphaned.
    """
    from sqlalchemy import text as _text
    
    try:
        result = self.db.execute(
            _text("""
                SELECT COUNT(*) as count 
                FROM payment_transactions 
                WHERE order_id = :order_id
            """),
            {"order_id": order_id}
        )
        count = result.scalar()
        
        if count == 0:
            logger.critical(
                f"🚨 DATA INTEGRITY VIOLATION: "
                f"Order {order_id} has NO payment_transactions record!"
            )
            # Trigger alert
            try:
                send_payment_integrity_alert(
                    order_id=order_id,
                    user_id=0,  # Would need to fetch from orders table
                    amount=0,
                    transaction_id="",
                    error="Order created without payment_transactions record"
                )
            except:
                pass
            
            return False
        
        logger.info(f"✓ Order {order_id} has valid payment trail ({count} records)")
        return True
        
    except Exception as e:
        logger.error(f"Failed to validate payment trail for order {order_id}: {e}")
        return False
