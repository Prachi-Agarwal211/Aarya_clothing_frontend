"""Database connection for commerce service with optimized connection pooling."""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from core.config import settings

# Optimized engine with connection pooling
# pool_recycle must be < PgBouncer server_idle_timeout (600s) to avoid stale connections
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,      # Base connections
    max_overflow=settings.DATABASE_MAX_OVERFLOW, # Additional connections under load
    pool_pre_ping=True,                          # Validate connections before use
    pool_recycle=300,                            # Recycle connections every 5 min (PgBouncer timeout is 10 min)
    pool_timeout=30,
    # CRITICAL: Disable psycopg2 prepared statements for PgBouncer transaction mode.
    connect_args={"prepare_threshold": None},
    echo=False
)

# Session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Better performance - objects accessible after commit
)

Base = declarative_base()
def get_db() -> Session:
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
@contextmanager
def get_db_context() -> Session:
    """Context manager for background tasks.

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
    from shared.db_migration_helpers import ensure_column
    from models.product import Product
    from models.order import Order, OrderItem
    from models.category import Category
    from models.inventory import Inventory
    from models.address import Address
    from models.review import Review
    from models.return_request import ReturnRequest
    from models.order_tracking import OrderTracking
    from models.product_image import ProductImage
    from models.user import User
    Base.metadata.create_all(bind=engine)
    # Schema drift prevention — add columns that create_all won't ALTER in
    ensure_column(engine, "users", "phone_verified", "BOOLEAN NOT NULL DEFAULT FALSE")
    ensure_column(engine, "users", "signup_verification_method", "VARCHAR(32)")
    ensure_column(engine, "products", "material", "TEXT")
    ensure_column(engine, "products", "care_instructions", "TEXT")
    ensure_column(engine, "reviews", "image_urls", "TEXT[] DEFAULT '{}'" )
def get_pool_status() -> dict:
    """Get connection pool status for monitoring."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "checked_in": engine.pool.checkedin(),
    }
