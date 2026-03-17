"""
Centralized Role Configuration for Aarya Clothing

Single source of truth for role hierarchy, permissions, and redirects.
Use these utilities instead of hardcoded role arrays throughout the codebase.

Usage:
    from shared.roles import UserRole, get_redirect_for_role, has_access
    
    redirect_url = get_redirect_for_role(user.role)
    can_access = has_access(user.role, 'admin')
"""

from enum import Enum
from typing import Dict, List, Optional


class UserRole(str, Enum):
    """User role enumeration - single source of truth."""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    STAFF = "staff"
    CUSTOMER = "customer"


# Role hierarchy with access levels and default redirects
# Higher level = more access
ROLE_HIERARCHY: Dict[UserRole, dict] = {
    UserRole.SUPER_ADMIN: {
        "level": 4,
        "redirect": "/admin/super",
        "label": "Super Admin",
    },
    UserRole.ADMIN: {
        "level": 3,
        "redirect": "/admin",
        "label": "Admin",
    },
    UserRole.STAFF: {
        "level": 2,
        "redirect": "/admin/staff",
        "label": "Staff",
    },
    UserRole.CUSTOMER: {
        "level": 1,
        "redirect": "/profile",
        "label": "Customer",
    },
}

# Role access lists for quick checks
ROLE_ACCESS = {
    "ADMIN": [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    "STAFF": [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN],
    "SUPER_ADMIN": [UserRole.SUPER_ADMIN],
    "CUSTOMER": [UserRole.CUSTOMER],
}


def get_redirect_for_role(role: UserRole) -> str:
    """
    Get the default redirect URL for a user role.
    
    Args:
        role: User role
        
    Returns:
        Default redirect URL
        
    Example:
        >>> get_redirect_for_role(UserRole.SUPER_ADMIN)
        '/admin/super'
        >>> get_redirect_for_role(UserRole.CUSTOMER)
        '/products'
    """
    return ROLE_HIERARCHY.get(role, ROLE_HIERARCHY[UserRole.CUSTOMER])["redirect"]


def has_access(user_role: UserRole, required_role: UserRole) -> bool:
    """
    Check if a user role has access to a required role level.
    
    Args:
        user_role: The user's current role
        required_role: The minimum required role level
        
    Returns:
        True if user has access
        
    Example:
        >>> has_access(UserRole.ADMIN, UserRole.STAFF)
        True
        >>> has_access(UserRole.CUSTOMER, UserRole.ADMIN)
        False
    """
    user_level = ROLE_HIERARCHY.get(user_role, {}).get("level", 0)
    required_level = ROLE_HIERARCHY.get(required_role, {}).get("level", 0)
    return user_level >= required_level


def has_role(user_role: UserRole, target_role: UserRole) -> bool:
    """
    Check if user has a specific role (exact match).
    
    Args:
        user_role: The user's current role
        target_role: The role to check for
        
    Returns:
        True if roles match exactly
    """
    return user_role == target_role


def is_admin(user_role: UserRole) -> bool:
    """
    Check if user is admin (admin or super_admin).
    
    Args:
        user_role: The user's current role
        
    Returns:
        True if user is admin or super_admin
    """
    return user_role in ROLE_ACCESS["ADMIN"]


def is_staff(user_role: UserRole) -> bool:
    """
    Check if user is staff (staff, admin, or super_admin).
    
    Args:
        user_role: The user's current role
        
    Returns:
        True if user is staff, admin, or super_admin
    """
    return user_role in ROLE_ACCESS["STAFF"]


def is_super_admin(user_role: UserRole) -> bool:
    """
    Check if user is super_admin.
    
    Args:
        user_role: The user's current role
        
    Returns:
        True if user is super_admin
    """
    return has_role(user_role, UserRole.SUPER_ADMIN)


def is_customer(user_role: UserRole) -> bool:
    """
    Check if user is customer.
    
    Args:
        user_role: The user's current role
        
    Returns:
        True if user is customer
    """
    return has_role(user_role, UserRole.CUSTOMER)


def get_role_label(role: UserRole) -> str:
    """
    Get role label for display.
    
    Args:
        role: User role
        
    Returns:
        Human-readable role label
    """
    return ROLE_HIERARCHY.get(role, {}).get("label", "Unknown")


def get_accessible_roles(required_role: UserRole) -> List[UserRole]:
    """
    Get all roles that can access a specific route level.
    
    Args:
        required_role: Minimum required role
        
    Returns:
        List of roles that can access
    """
    required_level = ROLE_HIERARCHY.get(required_role, {}).get("level", 0)
    return [
        role for role, config in ROLE_HIERARCHY.items()
        if config.get("level", 0) >= required_level
    ]


def is_valid_role(role: str) -> bool:
    """
    Validate role string.
    
    Args:
        role: Role to validate
        
    Returns:
        True if valid role
    """
    return role in [r.value for r in UserRole]


def get_role_from_string(role_str: str) -> Optional[UserRole]:
    """
    Get UserRole enum from string.
    
    Args:
        role_str: Role string
        
    Returns:
        UserRole enum or None if invalid
    """
    try:
        return UserRole(role_str)
    except ValueError:
        return None


# Export all utilities
__all__ = [
    "UserRole",
    "ROLE_HIERARCHY",
    "ROLE_ACCESS",
    "get_redirect_for_role",
    "has_access",
    "has_role",
    "is_admin",
    "is_staff",
    "is_super_admin",
    "is_customer",
    "get_role_label",
    "get_accessible_roles",
    "is_valid_role",
    "get_role_from_string",
]
