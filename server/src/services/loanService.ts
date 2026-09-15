import mongoose from 'mongoose';
import { LoanApplication } from '../models/LoanApplication';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import { LOAN_CONFIG } from '../constants';
import { isValidTransition } from '../constants';
import {
  LoanStatus,
  UserRole,
  AuditAction,
  EntityType,
  DocumentValidationStatus,
  EmploymentMode,
} from '../types';
import { calculateSimpleInterest, calculateTotalRepayment } from '../utils/helpers';
import { breService } from './breService';
import { auditService } from './auditService';
import { AppError } from '../middleware/errorHandler';

class LoanService {
  calculateLoan(principal: number, tenureDays: number) {
    const annualInterestRate = LOAN_CONFIG.ANNUAL_INTEREST_RATE;
    const interestAmount = calculateSimpleInterest(principal, annualInterestRate, tenureDays);
    const totalRepayment = calculateTotalRepayment(principal, interestAmount);
    return { principal, tenureDays, annualInterestRate, interestAmount, totalRepayment };
  }

  async createApplication(
    borrowerId: string,
    data: { principal: number; tenureDays: number; documentId: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    // 1. Verify borrower exists and has completed profile
    const borrower = await User.findById(borrowerId);
    if (!borrower) {
      throw new AppError('Borrower not found', 404, 'USER_NOT_FOUND');
    }
    if (!borrower.profileCompleted) {
      throw new AppError(
        'Please complete your profile before applying',
        422,
        'PROFILE_INCOMPLETE'
      );
    }

    // 2. Verify BRE eligibility
    if (!borrower.dateOfBirth || !borrower.monthlySalary || !borrower.pan || !borrower.employmentMode) {
      throw new AppError('Profile information is incomplete for BRE check', 422, 'PROFILE_INCOMPLETE');
    }
    const breResult = breService.evaluate({
      dateOfBirth: borrower.dateOfBirth,
      monthlySalary: borrower.monthlySalary,
      pan: borrower.pan,
      employmentMode: borrower.employmentMode as EmploymentMode,
    });
    if (!breResult.eligible) {
      throw new AppError('You are not eligible for a loan', 422, 'BRE_INELIGIBLE', {
        reasons: breResult.reasons.filter((r) => !r.passed),
      });
    }

    // 3. Verify document exists and is valid
    const document = await DocumentModel.findById(data.documentId);
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }
    if (document.uploadedBy.toString() !== borrowerId) {
      throw new AppError('Document does not belong to this borrower', 403, 'FORBIDDEN');
    }
    if (document.validationStatus !== DocumentValidationStatus.VALID) {
      throw new AppError('Document has not passed validation', 422, 'DOCUMENT_INVALID');
    }

    // 4. Validate loan amount and tenure
    if (data.principal < LOAN_CONFIG.MIN_AMOUNT || data.principal > LOAN_CONFIG.MAX_AMOUNT) {
      throw new AppError(
        `Loan amount must be between ₹${LOAN_CONFIG.MIN_AMOUNT.toLocaleString('en-IN')} and ₹${LOAN_CONFIG.MAX_AMOUNT.toLocaleString('en-IN')}`,
        422,
        'INVALID_AMOUNT'
      );
    }
    if (data.tenureDays < LOAN_CONFIG.MIN_TENURE_DAYS || data.tenureDays > LOAN_CONFIG.MAX_TENURE_DAYS) {
      throw new AppError(
        `Tenure must be between ${LOAN_CONFIG.MIN_TENURE_DAYS} and ${LOAN_CONFIG.MAX_TENURE_DAYS} days`,
        422,
        'INVALID_TENURE'
      );
    }

    // 5. Check for existing active application
    const existingActive = await LoanApplication.findOne({
      borrowerId,
      status: { $nin: [LoanStatus.REJECTED, LoanStatus.CLOSED] },
    });
    if (existingActive) {
      throw new AppError(
        'You already have an active loan application',
        409,
        'DUPLICATE_ACTIVE_APPLICATION',
        { existingApplicationId: existingActive._id.toString(), status: existingActive.status }
      );
    }

    // 6. Server-authoritative calculation
    const calculation = this.calculateLoan(data.principal, data.tenureDays);

    // 7. Create application
    const application = await LoanApplication.create({
      borrowerId,
      documentId: data.documentId,
      principal: calculation.principal,
      tenureDays: calculation.tenureDays,
      annualInterestRate: calculation.annualInterestRate,
      interestAmount: calculation.interestAmount,
      totalRepayment: calculation.totalRepayment,
      totalPaid: 0,
      outstandingAmount: calculation.totalRepayment,
      status: LoanStatus.APPLIED,
    });

    // 8. Link document to application
    await DocumentModel.findByIdAndUpdate(data.documentId, {
      applicationId: application._id,
    });

    // 9. Audit
    await auditService.log({
      actorId: borrowerId,
      actorRole: UserRole.BORROWER,
      action: AuditAction.APPLICATION_CREATED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: application._id.toString(),
      newState: {
        principal: application.principal,
        tenureDays: application.tenureDays,
        interestAmount: application.interestAmount,
        totalRepayment: application.totalRepayment,
        status: application.status,
      },
      ipAddress,
      userAgent,
    });

    // Audit BRE pass
    await auditService.log({
      actorId: borrowerId,
      actorRole: UserRole.BORROWER,
      action: AuditAction.BRE_PASSED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: application._id.toString(),
      metadata: { breResult },
      ipAddress,
      userAgent,
    });

    return application;
  }

  async getById(applicationId: string, requesterId: string, requesterRole: string) {
    const application = await LoanApplication.findById(applicationId)
      .populate('borrowerId', 'name email pan dateOfBirth monthlySalary employmentMode')
      .populate('documentId')
      .lean();

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Resource-level auth
    if (
      requesterRole === UserRole.BORROWER &&
      (application.borrowerId as any)._id.toString() !== requesterId
    ) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    return application;
  }

  async getMyApplications(borrowerId: string) {
    return LoanApplication.find({ borrowerId })
      .populate('documentId', 'originalName validationStatus')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getByStatus(status: LoanStatus | LoanStatus[], page = 1, limit = 20) {
    const query = Array.isArray(status) ? { status: { $in: status } } : { status };
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      LoanApplication.find(query)
        .populate('borrowerId', 'name email pan monthlySalary employmentMode')
        .populate('documentId', 'originalName validationStatus sha256')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanApplication.countDocuments(query),
    ]);

    return { applications, total };
  }

  async sanctionLoan(
    loanId: string,
    actorId: string,
    actorRole: UserRole,
    ipAddress?: string,
    userAgent?: string
  ) {
    const loan = await LoanApplication.findById(loanId);
    if (!loan) throw new AppError('Loan not found', 404, 'LOAN_NOT_FOUND');

    if (!isValidTransition(loan.status, LoanStatus.SANCTIONED, actorRole)) {
      throw new AppError(
        `Cannot transition from ${loan.status} to SANCTIONED`,
        422,
        'INVALID_STATE_TRANSITION',
        { currentStatus: loan.status, targetStatus: LoanStatus.SANCTIONED }
      );
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.SANCTIONED;
    loan.sanctionedBy = new mongoose.Types.ObjectId(actorId);
    loan.sanctionedAt = new Date();
    await loan.save();

    await auditService.log({
      actorId,
      actorRole,
      action: AuditAction.LOAN_APPROVED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: loanId,
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.SANCTIONED, sanctionedBy: actorId },
      ipAddress,
      userAgent,
    });

    return loan;
  }

  async rejectLoan(
    loanId: string,
    actorId: string,
    actorRole: UserRole,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('Rejection reason is required', 422, 'REJECTION_REASON_REQUIRED');
    }

    const loan = await LoanApplication.findById(loanId);
    if (!loan) throw new AppError('Loan not found', 404, 'LOAN_NOT_FOUND');

    if (!isValidTransition(loan.status, LoanStatus.REJECTED, actorRole)) {
      throw new AppError(
        `Cannot transition from ${loan.status} to REJECTED`,
        422,
        'INVALID_STATE_TRANSITION',
        { currentStatus: loan.status, targetStatus: LoanStatus.REJECTED }
      );
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.REJECTED;
    loan.rejectionReason = reason.trim();
    await loan.save();

    await auditService.log({
      actorId,
      actorRole,
      action: AuditAction.LOAN_REJECTED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: loanId,
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.REJECTED, rejectionReason: reason },
      ipAddress,
      userAgent,
    });

    return loan;
  }

  async disburseLoan(
    loanId: string,
    actorId: string,
    actorRole: UserRole,
    ipAddress?: string,
    userAgent?: string
  ) {
    const loan = await LoanApplication.findById(loanId);
    if (!loan) throw new AppError('Loan not found', 404, 'LOAN_NOT_FOUND');

    if (!isValidTransition(loan.status, LoanStatus.DISBURSED, actorRole)) {
      throw new AppError(
        `Cannot transition from ${loan.status} to DISBURSED`,
        422,
        'INVALID_STATE_TRANSITION',
        { currentStatus: loan.status, targetStatus: LoanStatus.DISBURSED }
      );
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.DISBURSED;
    loan.disbursedBy = new mongoose.Types.ObjectId(actorId);
    loan.disbursedAt = new Date();
    await loan.save();

    await auditService.log({
      actorId,
      actorRole,
      action: AuditAction.LOAN_DISBURSED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: loanId,
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.DISBURSED, disbursedBy: actorId },
      ipAddress,
      userAgent,
    });

    return loan;
  }

  // Dashboard aggregation queries
  async getDashboardStats() {
    const [
      totalApplications,
      applied,
      sanctioned,
      rejected,
      disbursed,
      closed,
    ] = await Promise.all([
      LoanApplication.countDocuments(),
      LoanApplication.countDocuments({ status: LoanStatus.APPLIED }),
      LoanApplication.countDocuments({ status: LoanStatus.SANCTIONED }),
      LoanApplication.countDocuments({ status: LoanStatus.REJECTED }),
      LoanApplication.countDocuments({ status: LoanStatus.DISBURSED }),
      LoanApplication.countDocuments({ status: LoanStatus.CLOSED }),
    ]);

    const outstandingAgg = await LoanApplication.aggregate([
      { $match: { status: LoanStatus.DISBURSED } },
      { $group: { _id: null, totalOutstanding: { $sum: '$outstandingAmount' } } },
    ]);

    return {
      totalApplications,
      applied,
      sanctioned,
      rejected,
      disbursed,
      closed,
      totalOutstanding: outstandingAgg[0]?.totalOutstanding || 0,
    };
  }
}

export const loanService = new LoanService();
