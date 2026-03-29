"""Database connection for commerce service with optimized connection pooling."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from core.config import settings

# Optimized engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,      # Base connections
    max_overflow=settings.DATABASE_MAX_OVERFLOW, # Additional connections under load
    pool_pre_ping=True,                          # Validate connections before use
    pool_recycle=3600,                           # Recycle connections every hour
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
    """Context manager for background tasks."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from models.product import Product
    from models.order import Order, OrderItem
    from models.category import Category
    from models.inventory import Inventory
    from models.address import Address
    from models.review import Review
    from models.wishlist import Wishlist
    from models.promotion import Promotion
    from models.return_request import ReturnRequest
    from models.order_tracking import OrderTracking
    from models.product_image import ProductImage
    from models.user import User, UserProfile
    Base.metadata.create_all(bind=engine)


def get_pool_status() -> dict:
    """Get connection pool status for monitoring."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "checked_in": engine.pool.checkedin(),
    }
