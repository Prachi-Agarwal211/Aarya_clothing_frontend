"""
Shared database migration helpers.

Provides common utilities for runtime schema changes (column additions)
and index creation that services need at startup. Eliminates duplication
across commerce, core, and payment database.py files.
"""
import re
import logging

logger = logging.getLogger(__name__)

# Strict regex for SQL identifiers - lowercase + underscores only
_IDENTIFIER_RE = re.compile(r'^[a-z_][a-z0-9_]{0,62}$')

# Cache of known existing indexes to avoid repeated DB inspection within a process
_known_indexes: set = set()


def ensure_column(
    engine,
    table: str,
    column: str,
    col_type: str,
) -> None:
    """
    Add a column to a table if it doesn't exist.

    Validates identifiers against injection before executing.

    Args:
        engine: SQLAlchemy engine
        table: Table name (must be lowercase alphanumeric + underscore)
        column: Column name (must be lowercase alphanumeric + underscore)
        col_type: Column type string (e.g. "BOOLEAN NOT NULL DEFAULT FALSE")
    """
    if not _IDENTIFIER_RE.match(table):
        raise ValueError(f"Invalid table name: {table!r}")
    if not _IDENTIFIER_RE.match(column):
        raise ValueError(f"Invalid column name: {column!r}")

    from sqlalchemy import text

    try:
        with engine.begin() as conn:
            conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
            ))
    except Exception as e:
        logger.debug("Column %s.%s already exists or error: %s", table, column, e)


def ensure_index(
    engine,
    table: str,
    index_name: str,
    columns: str,
    unique: bool = False,
) -> None:
    """
    Create an index on a table if it doesn't already exist.

    Validates identifiers against injection before executing.
    Uses an in-process cache to avoid repeated ``CREATE INDEX IF NOT EXISTS``
    calls that generate unnecessary PostgreSQL log noise on every startup.

    Args:
        engine: SQLAlchemy engine
        table: Table name (must be lowercase alphanumeric + underscore)
        index_name: Index name (must be lowercase alphanumeric + underscore)
        columns: Column expression (e.g. "user_id" or "user_id, status")
        unique: If True, create a UNIQUE index
    """
    if not _IDENTIFIER_RE.match(table):
        raise ValueError(f"Invalid table name: {table!r}")
    if not _IDENTIFIER_RE.match(index_name):
        raise ValueError(f"Invalid index name: {index_name!r}")

    global _known_indexes
    cache_key = f"{table}.{index_name}"
    if cache_key in _known_indexes:
        return

    from sqlalchemy import text, inspect

    # Check if index already exists (via inspection or cache)
    try:
        with engine.connect() as conn:
            inspector = inspect(engine)
            existing = {ix["name"] for ix in inspector.get_indexes(table)}
            if index_name in existing:
                _known_indexes.add(cache_key)
                logger.debug(f"Index {index_name} already exists on {table}")
                return
    except Exception:
        pass  # If inspection fails, try CREATE (will fail gracefully if exists)

    unique_clause = "UNIQUE" if unique else ""
    try:
        with engine.begin() as conn:
            # Use CONCURRENTLY to avoid locking the table for writes
            conn.execute(text(
                f"CREATE {unique_clause} INDEX CONCURRENTLY IF NOT EXISTS {index_name} ON {table} ({columns})"
            ))
            _known_indexes.add(cache_key)
            logger.info(f"✓ Created index {index_name} on {table}({columns})")
    except Exception:
        # CONCURRENTLY requires the connection to be outside a transaction block.
        # If the engine wraps in a transaction, fall back to non-concurrent.
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    f"CREATE {unique_clause} INDEX IF NOT EXISTS {index_name} ON {table} ({columns})"
                ))
                _known_indexes.add(cache_key)
                logger.info(f"✓ Created index {index_name} on {table}({columns})")
        except Exception as e2:
            logger.debug(f"Index {index_name} already exists or error: {e2}")
