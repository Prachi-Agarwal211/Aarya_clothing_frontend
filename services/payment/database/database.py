"""Database configuration for payment service."""
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import QueuePool
from core.config import settings
from shared.db_migration_helpers import ensure_column, ensure_index

logger = logging.getLogger(__name__)

# Create database engine (aligned with shared pool defaults)
# pool_recycle must be < PgBouncer server_idle_timeout (600s) to avoid stale connections
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=300,  # Recycle every 5 min (PgBouncer timeout is 10 min)
    pool_timeout=30,
    # CRITICAL: Disable psycopg2 prepared statements for PgBouncer transaction mode.
    connect_args={"prepare_threshold": None},
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Better performance - objects accessible after commit
)

# Base class for models
Base = declarative_base()

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context() -> Session:
    """Context manager for database session - use for background tasks.

    Rolls back on exception to prevent dirty state from leaking,
    then closes the session.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    """Initialize database tables."""
    from models.payment import PaymentTransaction, PaymentMethod, WebhookEvent

    Base.metadata.create_all(bind=engine)

    # Add columns that may be missing from existing tables (create_all won't ALTER)
    # Now using shared helper (consistent with core/commerce, fixes bad col_type validation)
    ensure_column(engine, "payment_transactions", "razorpay_qr_code_id", "VARCHAR(100)")
    ensure_column(engine, "payment_transactions", "razorpay_signature", "VARCHAR(500)")
    ensure_column(engine, "payment_transactions", "gateway_response", "JSON")
    ensure_column(engine, "payment_transactions", "description", "TEXT")
    ensure_column(engine, "payment_transactions", "customer_email", "VARCHAR(255)")
    ensure_column(engine, "payment_transactions", "customer_phone", "VARCHAR(20)")
    ensure_column(engine, "payment_transactions", "completed_at", "TIMESTAMP")
    ensure_column(engine, "payment_transactions", "refund_amount", "NUMERIC(10,2)")
    ensure_column(engine, "payment_transactions", "refund_id", "VARCHAR(100)")
    ensure_column(engine, "payment_transactions", "refund_status", "VARCHAR(50)")
    ensure_column(engine, "payment_transactions", "refund_reason", "TEXT")

    # Add indexes for _order_exists() queries — these columns are queried
    # frequently by the webhook handler without indexes, causing sequential scans.
    ensure_index(engine, "payment_transactions", "ix_payment_txn_razorpay_payment_id", "razorpay_payment_id")
    ensure_index(engine, "payment_transactions", "ix_payment_txn_razorpay_order_id", "razorpay_order_id")
    ensure_index(engine, "payment_transactions", "ix_payment_txn_qr_code_id", "razorpay_qr_code_id")
    ensure_index(engine, "payment_transactions", "ix_payment_txn_user_status", "user_id, status")

    logger.info("✓ Payment service: Database initialized")
