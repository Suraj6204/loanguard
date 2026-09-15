import { LoanStatus, UserRole } from '../types';

// ============================================================
// LOAN STATE MACHINE — Centralized Transition Map
// ============================================================

interface StateTransition {
  from: LoanStatus;
  to: LoanStatus;
  allowedRoles: UserRole[];
}

export const VALID_TRANSITIONS: StateTransition[] = [
  {
    from: LoanStatus.APPLIED,
    to: LoanStatus.SANCTIONED,
    allowedRoles: [UserRole.SANCTION, UserRole.ADMIN],
  },
  {
    from: LoanStatus.APPLIED,
    to: LoanStatus.REJECTED,
    allowedRoles: [UserRole.SANCTION, UserRole.ADMIN],
  },
  {
    from: LoanStatus.SANCTIONED,
    to: LoanStatus.DISBURSED,
    allowedRoles: [UserRole.DISBURSEMENT, UserRole.ADMIN],
  },
  {
    from: LoanStatus.DISBURSED,
    to: LoanStatus.CLOSED,
    allowedRoles: [UserRole.COLLECTION, UserRole.ADMIN],
  },
];

export function isValidTransition(
  from: LoanStatus,
  to: LoanStatus,
  role: UserRole
): boolean {
  return VALID_TRANSITIONS.some(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.allowedRoles.includes(role)
  );
}

export function getTransitionRoles(from: LoanStatus, to: LoanStatus): UserRole[] {
  const transition = VALID_TRANSITIONS.find(
    (t) => t.from === from && t.to === to
  );
  return transition ? transition.allowedRoles : [];
}

// ============================================================
// BRE THRESHOLDS
// ============================================================

export const BRE_THRESHOLDS = {
  MIN_AGE: 23,
  MAX_AGE: 50,
  MIN_SALARY: 25000,
  PAN_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
} as const;

// ============================================================
// LOAN CONFIGURATION
// ============================================================

export const LOAN_CONFIG = {
  MIN_AMOUNT: 50000,
  MAX_AMOUNT: 500000,
  MIN_TENURE_DAYS: 30,
  MAX_TENURE_DAYS: 365,
  ANNUAL_INTEREST_RATE: 12,
} as const;

// ============================================================
// DOCUMENT VALIDATION
// ============================================================

export const DOCUMENT_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ],
  SIGNED_URL_EXPIRY_SECONDS: 3600, // 1 hour
} as const;

// ============================================================
// MAGIC BYTE SIGNATURES
// ============================================================

export const FILE_SIGNATURES: Record<string, { bytes: number[]; offset: number }[]> = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }], // %PDF
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }],
};

// ============================================================
// ROLES CONFIGURATION
// ============================================================

export const OPERATIONS_ROLES = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SANCTION,
  UserRole.DISBURSEMENT,
  UserRole.COLLECTION,
];

export const ALL_ROLES = Object.values(UserRole);

// ============================================================
// PAGINATION DEFAULTS
// ============================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
