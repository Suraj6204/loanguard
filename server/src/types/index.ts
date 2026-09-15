import { Types } from 'mongoose';

// ============================================================
// ENUMS
// ============================================================

export enum UserRole {
  ADMIN = 'Admin',
  SALES = 'Sales',
  SANCTION = 'Sanction',
  DISBURSEMENT = 'Disbursement',
  COLLECTION = 'Collection',
  BORROWER = 'Borrower',
}

export enum EmploymentMode {
  SALARIED = 'Salaried',
  SELF_EMPLOYED = 'SelfEmployed',
  UNEMPLOYED = 'Unemployed',
}

export enum LoanStatus {
  APPLIED = 'APPLIED',
  SANCTIONED = 'SANCTIONED',
  REJECTED = 'REJECTED',
  DISBURSED = 'DISBURSED',
  CLOSED = 'CLOSED',
}

export enum DocumentValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  APPLICATION_CREATED = 'APPLICATION_CREATED',
  BRE_PASSED = 'BRE_PASSED',
  BRE_FAILED = 'BRE_FAILED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_VALIDATION_FAILED = 'DOCUMENT_VALIDATION_FAILED',
  DOCUMENT_VALIDATED = 'DOCUMENT_VALIDATED',
  LOAN_APPROVED = 'LOAN_APPROVED',
  LOAN_REJECTED = 'LOAN_REJECTED',
  LOAN_DISBURSED = 'LOAN_DISBURSED',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  LOAN_CLOSED = 'LOAN_CLOSED',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
}

export enum EntityType {
  USER = 'User',
  LOAN_APPLICATION = 'LoanApplication',
  DOCUMENT = 'Document',
  PAYMENT = 'Payment',
}

// ============================================================
// INTERFACES
// ============================================================

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  pan?: string;
  dateOfBirth?: Date;
  monthlySalary?: number;
  employmentMode?: EmploymentMode;
  profileCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoanApplication {
  _id: Types.ObjectId;
  borrowerId: Types.ObjectId;
  documentId: Types.ObjectId;
  principal: number;
  tenureDays: number;
  annualInterestRate: number;
  interestAmount: number;
  totalRepayment: number;
  totalPaid: number;
  outstandingAmount: number;
  status: LoanStatus;
  rejectionReason?: string;
  sanctionedBy?: Types.ObjectId;
  sanctionedAt?: Date;
  disbursedBy?: Types.ObjectId;
  disbursedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocument {
  _id: Types.ObjectId;
  applicationId?: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  validationStatus: DocumentValidationStatus;
  validationResults: IValidationResults;
  createdAt: Date;
}

export interface IPayment {
  _id: Types.ObjectId;
  loanId: Types.ObjectId;
  utrNumber: string;
  amount: number;
  paymentDate: Date;
  recordedBy: Types.ObjectId;
  createdAt: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: Types.ObjectId;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================================
// VALIDATION & BRE TYPES
// ============================================================

export interface IRuleResult {
  rule: string;
  passed: boolean;
  message: string;
}

export interface IBREResult {
  eligible: boolean;
  reasons: IRuleResult[];
}

export interface IValidationStepResult {
  step: string;
  passed: boolean;
  message: string;
}

export interface IValidationResults {
  steps: IValidationStepResult[];
  overall: boolean;
}

// ============================================================
// LOAN CALCULATION TYPES
// ============================================================

export interface ILoanCalculation {
  principal: number;
  tenureDays: number;
  annualInterestRate: number;
  interestAmount: number;
  totalRepayment: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  details?: Record<string, unknown>;
}

export interface IPaginatedResponse<T = unknown> extends IApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================
// REQUEST AUGMENTATION
// ============================================================

export interface IAuthPayload {
  userId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthPayload;
    }
  }
}
