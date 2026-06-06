"""
Shared database migration helpers.

Provides common utilities for runtime schema changes (column additions)
that services need at startup. Eliminates duplication across commerce,
core, and payment database.py files.
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Strict regex for SQL identifiers - lowercase + underscores only
_IDENTIFIER_RE = re.compile(r'^[a-z_][a-z0-9_]{0,62}$')


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
