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


def _ensure_users_phone_verified_column() -> None:
    import logging

    log = logging.getLogger(__name__)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
    except Exception as e:
        log.warning("Could not ensure phone_verified column on users: %s", e)


def _ensure_users_signup_verification_method_column() -> None:
    import logging

    log = logging.getLogger(__name__)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_verification_method VARCHAR(32)"
                )
            )
    except Exception as e:
        log.warning("Could not ensure signup_verification_method column on users: %s", e)


def _ensure_products_material_care_columns() -> None:
    import logging

    log = logging.getLogger(__name__)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions TEXT"
                )
            )
    except Exception as e:
        log.warning("Could not ensure material/care_instructions columns on products: %s", e)


def _ensure_reviews_image_urls_column() -> None:
    """Add image_urls column to reviews table if it doesn't exist."""
    import logging

    log = logging.getLogger(__name__)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'"
                )
            )
    except Exception as e:
        log.warning("Could not ensure image_urls column on reviews: %s", e)


def init_db():
    """Initialize database tables."""
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
    _ensure_users_phone_verified_column()
    _ensure_users_signup_verification_method_column()
    _ensure_products_material_care_columns()
    _ensure_reviews_image_urls_column()


def get_pool_status() -> dict:
    """Get connection pool status for monitoring."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "checked_in": engine.pool.checkedin(),
    }
