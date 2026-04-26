"""Database configuration for payment service."""
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import QueuePool
from core.config import settings

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
    """Context manager for database session - use for background tasks."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables."""
    from models.payment import PaymentTransaction, PaymentMethod, WebhookEvent
    from sqlalchemy import text

    Base.metadata.create_all(bind=engine)

    # Add columns that may be missing from existing tables (create_all won't ALTER)
    _ensure_column("payment_transactions", "razorpay_qr_code_id", "VARCHAR(100)")
    _ensure_column("payment_transactions", "razorpay_signature", "VARCHAR(500)")
    _ensure_column("payment_transactions", "gateway_response", "JSON")
    _ensure_column("payment_transactions", "description", "TEXT")
    _ensure_column("payment_transactions", "customer_email", "VARCHAR(255)")
    _ensure_column("payment_transactions", "customer_phone", "VARCHAR(20)")
    _ensure_column("payment_transactions", "completed_at", "TIMESTAMP")
    _ensure_column("payment_transactions", "refund_amount", "NUMERIC(10,2)")
    _ensure_column("payment_transactions", "refund_id", "VARCHAR(100)")
    _ensure_column("payment_transactions", "refund_status", "VARCHAR(50)")
    _ensure_column("payment_transactions", "refund_reason", "TEXT")

    logger.info("✓ Payment service: Database initialized")


def _ensure_column(table: str, column: str, col_type: str) -> None:
    """Add a column to a table if it doesn't already exist."""
    try:
        with engine.begin() as conn:
            conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
            ))
    except Exception as e:
        logger.debug(f"Column {table}.{column} check: {e}")
