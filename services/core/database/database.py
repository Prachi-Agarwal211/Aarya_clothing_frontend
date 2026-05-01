"""Database connection and session management with optimized connection pooling."""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from core.config import settings
import os

# Get database URL from settings or environment
if settings is not None:
    DATABASE_URL = settings.DATABASE_URL
    DATABASE_POOL_SIZE = settings.DATABASE_POOL_SIZE
    DATABASE_MAX_OVERFLOW = settings.DATABASE_MAX_OVERFLOW
    DEBUG = settings.DEBUG
else:
    # Fallback to environment variables with safe defaults
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/aarya_clothing")
    DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "8"))  # Aligned with shared/base_config.py
    DATABASE_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "7"))  # Aligned with shared/base_config.py
    DEBUG = False

# Create optimized engine with connection pooling
# pool_recycle must be < PgBouncer server_idle_timeout (600s) to avoid stale connections
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=DATABASE_POOL_SIZE,      # Base connections
    max_overflow=DATABASE_MAX_OVERFLOW, # Additional connections under load
    pool_pre_ping=True,                 # Validate connections before use
    pool_recycle=300,                   # Recycle every 5 min (PgBouncer timeout is 10 min)
    pool_timeout=30,                    # Fail fast when pool exhausted (avoid hung requests)
    echo=DEBUG
)

# Create session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Better performance - objects accessible after commit
)

# Create base class for models
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
    """Add phone_verified if missing (shared users table; create_all does not ALTER)."""
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


def init_db():
    """Initialize database tables."""
    # Import all models here so Base knows about them
    from models import User, EmailVerification, OTP
    # UserProfile is deprecated - fields moved to User model
    # from models import UserProfile
    # UserSecurity is deprecated - fields moved to User model
    # from models import UserSecurity

    # Skip create_all to avoid foreign key issues with database initialization order
    # Tables are created by init.sql script
    # Base.metadata.create_all(bind=engine)
    _ensure_users_phone_verified_column()
    _ensure_users_signup_verification_method_column()


def get_pool_status() -> dict:
    """Get connection pool status for monitoring."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "checked_in": engine.pool.checkedin(),
    }
