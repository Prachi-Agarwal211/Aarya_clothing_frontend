"""
Commerce User Model - Now uses consolidated Core User model
This file is deprecated - use core.models.user_consolidated.User instead
"""
from services.core.models.user_consolidated import User, UserRole

# Import consolidated models for reference
User = User  # This is now the consolidated User model
UserRole = UserRole  # This now includes super_admin role

# Note: All user-related operations should now use the Core service API
# instead of direct database access to avoid schema conflicts