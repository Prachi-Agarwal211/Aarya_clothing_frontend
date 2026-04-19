/**
 * Centralized Role Configuration for Aarya Clothing
 *
 * Single source of truth for role hierarchy, permissions, and redirects.
 * Use these utilities instead of hardcoded role arrays throughout the codebase.
 *
 * @example
 * import { getRedirectForRole, hasAccess, USER_ROLES } from '@/lib/roles';
 * const redirectUrl = getRedirectForRole(user.role);
 * const canAccess = hasAccess(user.role, 'admin');
 */

/**
 * User role constants — single source of truth for role strings
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

/**
 * Role hierarchy with access levels and default redirects
 * Higher level = more access
 */
export const ROLE_HIERARCHY = {
  [USER_ROLES.SUPER_ADMIN]: {
    level: 4,
    redirect: '/admin/super',
    label: 'Super Admin',
    canAccess: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.CUSTOMER],
  },
  [USER_ROLES.ADMIN]: {
    level: 3,
    redirect: '/admin',
    label: 'Admin',
    canAccess: [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.CUSTOMER],
  },
  [USER_ROLES.STAFF]: {
    level: 2,
    redirect: '/admin/staff',
    label: 'Staff',
    canAccess: [USER_ROLES.STAFF, USER_ROLES.CUSTOMER],
  },
  [USER_ROLES.CUSTOMER]: {
    level: 1,
    redirect: '/products', // Customers land on the catalog after login/register
    label: 'Customer',
    canAccess: [USER_ROLES.CUSTOMER],
  },
};

/**
 * Role access levels for quick checks
 */
export const ROLE_ACCESS = {
  /** Admin-only routes (admin + super_admin) */
  ADMIN: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  /** Staff routes (staff + admin + super_admin) */
  STAFF: [USER_ROLES.STAFF, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  /** Super admin only */
  SUPER_ADMIN: [USER_ROLES.SUPER_ADMIN],
  /** Customer only */
  CUSTOMER: [USER_ROLES.CUSTOMER],
};

/**
 * Get the default redirect URL for a user role
 * @param {string} role - User role
 * @returns {string} Default redirect URL
 *
 * @example
 * getRedirectForRole('super_admin') // '/admin/super'
 * getRedirectForRole('customer') // '/products'
 */
export function getRedirectForRole(role) {
  return ROLE_HIERARCHY[role]?.redirect || ROLE_HIERARCHY[USER_ROLES.CUSTOMER].redirect;
}

/**
 * Check if a user role has access to a required role level
 * @param {string} userRole - The user's current role
 * @param {string} requiredRole - The minimum required role level
 * @returns {boolean} True if user has access
 *
 * @example
 * hasAccess('admin', 'staff') // true (admin can access staff routes)
 * hasAccess('customer', 'admin') // false (customer cannot access admin routes)
 */
export function hasAccess(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole]?.level || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole]?.level || 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user has a specific role (exact match)
 * @param {string} userRole - The user's current role
 * @param {string} targetRole - The role to check for
 * @returns {boolean} True if roles match exactly
 */
export function hasRole(userRole, targetRole) {
  return userRole === targetRole;
}

/**
 * Check if user is admin (admin or super_admin)
 * @param {string} userRole - The user's current role
 * @returns {boolean} True if user is admin or super_admin
 */
export function isAdmin(userRole) {
  return ROLE_ACCESS.ADMIN.includes(userRole);
}

/**
 * Check if user is staff (staff, admin, or super_admin)
 * @param {string} userRole - The user's current role
 * @returns {boolean} True if user is staff, admin, or super_admin
 */
export function isStaff(userRole) {
  return ROLE_ACCESS.STAFF.includes(userRole);
}

/**
 * Check if user is super_admin
 * @param {string} userRole - The user's current role
 * @returns {boolean} True if user is super_admin
 */
export function isSuperAdmin(userRole) {
  return hasRole(userRole, USER_ROLES.SUPER_ADMIN);
}

/**
 * Check if user is customer
 * @param {string} userRole - The user's current role
 * @returns {boolean} True if user is customer
 */
export function isCustomer(userRole) {
  return hasRole(userRole, USER_ROLES.CUSTOMER);
}

/**
 * Get role label for display
 * @param {string} role - User role
 * @returns {string} Human-readable role label
 */
export function getRoleLabel(role) {
  return ROLE_HIERARCHY[role]?.label || 'Unknown';
}

/**
 * Get all roles that can access a specific route level
 * @param {string} requiredRole - Minimum required role
 * @returns {string[]} Array of roles that can access
 */
export function getAccessibleRoles(requiredRole) {
  const requiredLevel = ROLE_HIERARCHY[requiredRole]?.level || 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, config]) => config.level >= requiredLevel)
    .map(([role]) => role);
}

/**
 * Validate role string
 * @param {string} role - Role to validate
 * @returns {boolean} True if valid role
 */
export function isValidRole(role) {
  return Object.values(USER_ROLES).includes(role);
}

// Default export with all utilities
export default {
  USER_ROLES,
  ROLE_HIERARCHY,
  ROLE_ACCESS,
  getRedirectForRole,
  hasAccess,
  hasRole,
  isAdmin,
  isStaff,
  isSuperAdmin,
  isCustomer,
  getRoleLabel,
  getAccessibleRoles,
  isValidRole,
};
