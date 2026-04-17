"""Database configuration for payment service."""
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
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
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_context():
    """Context manager for database session - use for background tasks."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables."""
    from models.payment import PaymentTransaction, PaymentMethod, WebhookEvent
    
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Payment service: Database initialized")
