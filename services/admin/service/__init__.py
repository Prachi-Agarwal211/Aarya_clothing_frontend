# Admin Service - Unified admin operations.
#
# We re-export only the services that are actively imported by routes/main.py.
# Product / inventory admin logic currently lives inline in main.py — keep it
# there until the planned route extraction lands rather than maintaining two
# copies in parallel.

__all__ = [
    "AdminDashboardService",
]
