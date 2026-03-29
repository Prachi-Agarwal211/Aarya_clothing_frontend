"""
Shared models module.

This file previously contained ORM definitions for tables owned by other services
(User, Order, Product, etc.). These have been removed to enforce strict service
boundaries. The Admin service now interacts with these domains via:
1. API calls (for operations)
2. Raw SQL (for read-only analytics/dashboard aggregation)
"""
