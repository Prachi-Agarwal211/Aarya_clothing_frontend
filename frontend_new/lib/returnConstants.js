/**
 * Shared constants for Return/Exchange functionality
 * Used by both customer and admin pages
 * 
 * IMPORTANT: These must match the backend enums in services/commerce/models/return_request.py
 */

// Backend ReturnStatus enum: requested, approved, rejected, received, refunded
export const RETURN_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RECEIVED: 'received',
  REFUNDED: 'refunded',
};

// Status configuration for UI display
export const STATUS_CONFIG = {
  [RETURN_STATUS.REQUESTED]: { 
    label: 'Requested', 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-400/10', 
    icon: 'Clock',
    description: 'Return request submitted, awaiting review'
  },
  [RETURN_STATUS.APPROVED]: { 
    label: 'Approved', 
    color: 'text-blue-400', 
    bg: 'bg-blue-400/10', 
    icon: 'CheckCircle',
    description: 'Return approved, awaiting item pickup/receipt'
  },
  [RETURN_STATUS.REJECTED]: { 
    label: 'Rejected', 
    color: 'text-red-400', 
    bg: 'bg-red-400/10', 
    icon: 'XCircle',
    description: 'Return request rejected'
  },
  [RETURN_STATUS.RECEIVED]: { 
    label: 'Item Received', 
    color: 'text-purple-400', 
    bg: 'bg-purple-400/10', 
    icon: 'Package',
    description: 'Item received at warehouse, processing refund'
  },
  [RETURN_STATUS.REFUNDED]: { 
    label: 'Refunded', 
    color: 'text-green-400', 
    bg: 'bg-green-400/10', 
    icon: 'CheckCircle',
    description: 'Refund processed successfully'
  },
};

// Backend ReturnReason enum: defective, wrong_item, not_as_described, size_issue, color_issue, changed_mind, other
export const RETURN_REASONS = {
  DEFECTIVE: 'defective',
  WRONG_ITEM: 'wrong_item',
  NOT_AS_DESCRIBED: 'not_as_described',
  SIZE_ISSUE: 'size_issue',
  COLOR_ISSUE: 'color_issue',
  CHANGED_MIND: 'changed_mind',
  OTHER: 'other',
};

// Reason labels for UI display
export const REASON_LABELS = {
  [RETURN_REASONS.DEFECTIVE]: 'Defective Product',
  [RETURN_REASONS.WRONG_ITEM]: 'Wrong Item Received',
  [RETURN_REASONS.NOT_AS_DESCRIBED]: 'Not As Described',
  [RETURN_REASONS.SIZE_ISSUE]: 'Size Issue',
  [RETURN_REASONS.COLOR_ISSUE]: 'Color Issue',
  [RETURN_REASONS.CHANGED_MIND]: 'Changed Mind',
  [RETURN_REASONS.OTHER]: 'Other Reason',
};

// Return type labels
export const TYPE_LABELS = {
  return: 'Return',
  exchange: 'Exchange',
};

// Status options for filter dropdowns
export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: RETURN_STATUS.REQUESTED, label: 'Requested' },
  { value: RETURN_STATUS.APPROVED, label: 'Approved' },
  { value: RETURN_STATUS.RECEIVED, label: 'Received' },
  { value: RETURN_STATUS.REFUNDED, label: 'Refunded' },
  { value: RETURN_STATUS.REJECTED, label: 'Rejected' },
];

// Reason options for forms
export const REASON_OPTIONS = [
  { value: RETURN_REASONS.DEFECTIVE, label: REASON_LABELS[RETURN_REASONS.DEFECTIVE] },
  { value: RETURN_REASONS.WRONG_ITEM, label: REASON_LABELS[RETURN_REASONS.WRONG_ITEM] },
  { value: RETURN_REASONS.NOT_AS_DESCRIBED, label: REASON_LABELS[RETURN_REASONS.NOT_AS_DESCRIBED] },
  { value: RETURN_REASONS.SIZE_ISSUE, label: REASON_LABELS[RETURN_REASONS.SIZE_ISSUE] },
  { value: RETURN_REASONS.COLOR_ISSUE, label: REASON_LABELS[RETURN_REASONS.COLOR_ISSUE] },
  { value: RETURN_REASONS.CHANGED_MIND, label: REASON_LABELS[RETURN_REASONS.CHANGED_MIND] },
  { value: RETURN_REASONS.OTHER, label: REASON_LABELS[RETURN_REASONS.OTHER] },
];

// Helper function to get status config
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG[RETURN_STATUS.REQUESTED];
}

// Helper function to get reason label
export function getReasonLabel(reason) {
  return REASON_LABELS[reason] || reason;
}
