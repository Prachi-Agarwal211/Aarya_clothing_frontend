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
    # CRITICAL: Disable psycopg2 prepared statements for PgBouncer transaction mode.
    # PgBouncer closes connections between transactions, so prepared statements are lost.
    connect_args={"prepare_threshold": None},
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
    from models import User, EmailVerification

    # Skip create_all to avoid foreign key issues with database initialization order
    # Tables are created by init.sql script
    # Base.metadata.create_all(bind=engine)

    # Schema drift prevention - add columns that create_all won't ALTER in
    ensure_column(engine, "users", "phone_verified", "BOOLEAN NOT NULL DEFAULT FALSE")
    ensure_column(engine, "users", "signup_verification_method", "VARCHAR(32)")
    ensure_column(engine, "users", "first_name", "VARCHAR(50)")
    ensure_column(engine, "users", "last_name", "VARCHAR(50)")
    ensure_column(engine, "users", "failed_login_attempts", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(engine, "users", "account_locked_until", "TIMESTAMP")
    ensure_column(engine, "users", "last_login_at", "TIMESTAMP")
    ensure_column(engine, "users", "password_changed_at", "TIMESTAMP")
def get_pool_status() -> dict:
    """Get connection pool status for monitoring."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "checked_in": engine.pool.checkedin(),
    }
