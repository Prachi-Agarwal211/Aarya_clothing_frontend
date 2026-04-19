"""
Core User Model - Now uses consolidated User model
This file is deprecated - use models.user_consolidated.User instead
"""
from models.user_consolidated import User, UserRole

# Import consolidated models for reference
User = User  # This is now the consolidated User model
UserRole = UserRole  # This now includes super_admin role

# Note: All user-related operations should use the consolidated model
