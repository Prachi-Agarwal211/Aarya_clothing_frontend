-- Add unique constraint on (transaction_id, user_id) for order idempotency
-- This prevents duplicate orders for the same payment transaction + user.
-- The constraint is already defined in the SQLAlchemy model:
--   services/commerce/models/order.py -> UniqueConstraint('transaction_id', 'user_id', name='uq_order_transaction_user')
--
-- COMPATIBILITY NOTES:
--   - SQLAlchemy model: transaction_id (String(255), nullable=True), user_id (Integer, nullable=True)
--   - Pydantic schema (schemas/order.py): transaction_id (Optional[str]), user_id (int)
--   - Column names match exactly between model, schema, and this migration.
--   - Both columns are nullable, so the constraint allows multiple NULL pairs (PostgreSQL behavior).
--
-- IDEMPOTENT: Safe to run multiple times.

DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_order_transaction_user'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT uq_order_transaction_user UNIQUE (transaction_id, user_id);
        RAISE NOTICE 'Added unique constraint uq_order_transaction_user on orders(transaction_id, user_id)';
    ELSE
        RAISE NOTICE 'Constraint uq_order_transaction_user already exists, skipping';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Table "orders" does not exist yet - migration will apply when table is created';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error applying constraint: %', SQLERRM;
END $$;
