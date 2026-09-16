import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { LoanApplication } from '../models/LoanApplication';
import { User } from '../models/User';
import { DocumentModel } from '../models/Document';
import { Payment } from '../models/Payment';
import { AuditLog } from '../models/AuditLog';
import { LOAN_CONFIG, isValidTransition } from '../constants';
import { LoanStatus, UserRole, AuditAction, EntityType, DocumentValidationStatus, EmploymentMode } from '../types';
import { calculateSimpleInterest, calculateTotalRepayment } from '../utils/helpers';
import { evaluateBRE } from './borrowerController';

// ------------------------------------------------------------------
// LOAN UTILITIES
// ------------------------------------------------------------------

const calculateLoan = (principal: number, tenureDays: number) => {
  const annualInterestRate = LOAN_CONFIG.ANNUAL_INTEREST_RATE;
  const interestAmount = calculateSimpleInterest(principal, annualInterestRate, tenureDays);
  const totalRepayment = calculateTotalRepayment(principal, interestAmount);
  return { principal, tenureDays, annualInterestRate, interestAmount, totalRepayment };
};

// ------------------------------------------------------------------
// ROUTE HANDLERS
// ------------------------------------------------------------------

export const calculate = async (req: Request, res: Response) => {
  try {
    const { principal, tenureDays } = req.body;
    const result = calculateLoan(principal, tenureDays);
    res.status(200).json({ success: true, message: 'Loan calculation', data: result });
  } catch (error: any) {
    console.error('Calculate error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const borrowerId = req.user!.userId;
    const data = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const borrower = await User.findById(borrowerId);
    if (!borrower) {
      res.status(404).json({ success: false, message: 'Borrower not found', code: 'USER_NOT_FOUND' });
      return;
    }
    if (!borrower.profileCompleted) {
      res.status(422).json({ success: false, message: 'Please complete your profile before applying', code: 'PROFILE_INCOMPLETE' });
      return;
    }

    if (!borrower.dateOfBirth || !borrower.monthlySalary || !borrower.pan || !borrower.employmentMode) {
      res.status(422).json({ success: false, message: 'Profile information is incomplete for BRE check', code: 'PROFILE_INCOMPLETE' });
      return;
    }
    const breResult = evaluateBRE({
      dateOfBirth: borrower.dateOfBirth,
      monthlySalary: borrower.monthlySalary,
      pan: borrower.pan,
      employmentMode: borrower.employmentMode as EmploymentMode,
    });
    if (!breResult.eligible) {
      res.status(422).json({ success: false, message: 'You are not eligible for a loan', code: 'BRE_INELIGIBLE', details: { reasons: breResult.reasons.filter((r) => !r.passed) } });
      return;
    }

    const document = await DocumentModel.findById(data.documentId);
    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found', code: 'DOCUMENT_NOT_FOUND' });
      return;
    }
    if (document.uploadedBy.toString() !== borrowerId) {
      res.status(403).json({ success: false, message: 'Document does not belong to this borrower', code: 'FORBIDDEN' });
      return;
    }
    if (document.validationStatus !== DocumentValidationStatus.VALID) {
      res.status(422).json({ success: false, message: 'Document has not passed validation', code: 'DOCUMENT_INVALID' });
      return;
    }

    if (data.principal < LOAN_CONFIG.MIN_AMOUNT || data.principal > LOAN_CONFIG.MAX_AMOUNT) {
      res.status(422).json({ success: false, message: `Loan amount must be between ₹${LOAN_CONFIG.MIN_AMOUNT.toLocaleString('en-IN')} and ₹${LOAN_CONFIG.MAX_AMOUNT.toLocaleString('en-IN')}`, code: 'INVALID_AMOUNT' });
      return;
    }
    if (data.tenureDays < LOAN_CONFIG.MIN_TENURE_DAYS || data.tenureDays > LOAN_CONFIG.MAX_TENURE_DAYS) {
      res.status(422).json({ success: false, message: `Tenure must be between ${LOAN_CONFIG.MIN_TENURE_DAYS} and ${LOAN_CONFIG.MAX_TENURE_DAYS} days`, code: 'INVALID_TENURE' });
      return;
    }

    const existingActive = await LoanApplication.findOne({
      borrowerId,
      status: { $nin: [LoanStatus.REJECTED, LoanStatus.CLOSED] },
    });
    if (existingActive) {
      res.status(409).json({ success: false, message: 'You already have an active loan application', code: 'DUPLICATE_ACTIVE_APPLICATION', details: { existingApplicationId: existingActive._id.toString(), status: existingActive.status } });
      return;
    }

    const calculation = calculateLoan(data.principal, data.tenureDays);

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

    await DocumentModel.findByIdAndUpdate(data.documentId, { applicationId: application._id });

    await AuditLog.create({
      actorId: new Types.ObjectId(borrowerId),
      actorRole: UserRole.BORROWER,
      action: AuditAction.APPLICATION_CREATED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: new Types.ObjectId(application._id.toString()),
      newState: { principal: application.principal, tenureDays: application.tenureDays, interestAmount: application.interestAmount, totalRepayment: application.totalRepayment, status: application.status },
      ipAddress,
      userAgent,
    });

    await AuditLog.create({
      actorId: new Types.ObjectId(borrowerId),
      actorRole: UserRole.BORROWER,
      action: AuditAction.BRE_PASSED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: new Types.ObjectId(application._id.toString()),
      metadata: { breResult },
      ipAddress,
      userAgent,
    });

    res.status(201).json({ success: true, message: 'Loan application created successfully', data: { application } });
  } catch (error: any) {
    console.error('Create loan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getMyApplications = async (req: Request, res: Response) => {
  try {
    const applications = await LoanApplication.find({ borrowerId: req.user!.userId }).sort({ createdAt: -1 }).populate('documentId', 'originalName validationStatus storageKey').lean();
    res.status(200).json({ success: true, message: 'Success', data: { applications } });
  } catch (error: any) {
    console.error('Get my applications error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const application = await LoanApplication.findById(req.params.id)
      .populate('borrowerId', 'name email pan dateOfBirth monthlySalary employmentMode profileCompleted')
      .populate('documentId')
      .populate('sanctionedBy', 'name email role')
      .populate('disbursedBy', 'name email role')
      .lean();
    if (!application) {
      res.status(404).json({ success: false, message: 'Loan application not found', code: 'LOAN_NOT_FOUND' });
      return;
    }
    if (req.user!.role === 'Borrower' && application.borrowerId._id.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Access denied', code: 'FORBIDDEN' });
      return;
    }
    res.status(200).json({ success: true, message: 'Success', data: { application } });
  } catch (error: any) {
    console.error('Get by ID error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const sanction = async (req: Request, res: Response) => {
  try {
    const loanId = req.params.id;
    const actorId = req.user!.userId;
    const actorRole = req.user!.role;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan application not found', code: 'LOAN_NOT_FOUND' });
      return;
    }
    if (!isValidTransition(loan.status, LoanStatus.SANCTIONED, actorRole as UserRole)) {
      res.status(422).json({ success: false, message: `Cannot transition from ${loan.status} to SANCTIONED`, code: 'INVALID_STATE_TRANSITION', details: { currentStatus: loan.status, targetStatus: LoanStatus.SANCTIONED } });
      return;
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.SANCTIONED;
    loan.sanctionedBy = new mongoose.Types.ObjectId(actorId);
    loan.sanctionedAt = new Date();
    await loan.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: AuditAction.LOAN_APPROVED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: new Types.ObjectId(loanId as string),
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.SANCTIONED, sanctionedBy: actorId },
      ipAddress,
      userAgent,
    });

    res.status(200).json({ success: true, message: 'Loan sanctioned successfully', data: { loan } });
  } catch (error: any) {
    console.error('Sanction loan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const reject = async (req: Request, res: Response) => {
  try {
    const loanId = req.params.id;
    const actorId = req.user!.userId;
    const actorRole = req.user!.role;
    const reason = req.body.reason;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!reason || reason.trim().length === 0) {
      res.status(422).json({ success: false, message: 'Rejection reason is required', code: 'REASON_REQUIRED' });
      return;
    }

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan application not found', code: 'LOAN_NOT_FOUND' });
      return;
    }
    if (!isValidTransition(loan.status, LoanStatus.REJECTED, actorRole as UserRole)) {
      res.status(422).json({ success: false, message: `Cannot transition from ${loan.status} to REJECTED`, code: 'INVALID_STATE_TRANSITION', details: { currentStatus: loan.status, targetStatus: LoanStatus.REJECTED } });
      return;
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.REJECTED;
    loan.rejectionReason = reason;
    await loan.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: AuditAction.LOAN_REJECTED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: new Types.ObjectId(loanId as string),
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.REJECTED, rejectionReason: reason },
      metadata: { reason },
      ipAddress,
      userAgent,
    });

    res.status(200).json({ success: true, message: 'Loan rejected', data: { loan } });
  } catch (error: any) {
    console.error('Reject loan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const disburse = async (req: Request, res: Response) => {
  try {
    const loanId = req.params.id;
    const actorId = req.user!.userId;
    const actorRole = req.user!.role;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan application not found', code: 'LOAN_NOT_FOUND' });
      return;
    }
    if (!isValidTransition(loan.status, LoanStatus.DISBURSED, actorRole as UserRole)) {
      res.status(422).json({ success: false, message: `Cannot transition from ${loan.status} to DISBURSED`, code: 'INVALID_STATE_TRANSITION', details: { currentStatus: loan.status, targetStatus: LoanStatus.DISBURSED } });
      return;
    }

    const previousStatus = loan.status;
    loan.status = LoanStatus.DISBURSED;
    loan.disbursedBy = new mongoose.Types.ObjectId(actorId);
    loan.disbursedAt = new Date();
    await loan.save();

    await AuditLog.create({
      actorId: new Types.ObjectId(actorId),
      actorRole,
      action: AuditAction.LOAN_DISBURSED,
      entityType: EntityType.LOAN_APPLICATION,
      entityId: new Types.ObjectId(loanId as string),
      previousState: { status: previousStatus },
      newState: { status: LoanStatus.DISBURSED, disbursedBy: actorId },
      ipAddress,
      userAgent,
    });

    res.status(200).json({ success: true, message: 'Loan disbursed successfully', data: { loan } });
  } catch (error: any) {
    console.error('Disburse loan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const recordPayment = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const loanId = req.params.id;
    const data = req.body;
    const recordedBy = req.user!.userId;
    const actorRole = req.user!.role;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

    const loan = await LoanApplication.findById(loanId).session(session);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found', code: 'LOAN_NOT_FOUND' });
      return;
    }
    if (loan.status !== LoanStatus.DISBURSED) {
      res.status(422).json({ success: false, message: `Payments can only be recorded for DISBURSED loans. Current status: ${loan.status}`, code: 'INVALID_LOAN_STATUS', details: { currentStatus: loan.status } });
      return;
    }
    if (!data.utrNumber || data.utrNumber.trim().length === 0) {
      res.status(422).json({ success: false, message: 'UTR number is required', code: 'UTR_REQUIRED' });
      return;
    }
    if (!data.amount || data.amount <= 0) {
      res.status(422).json({ success: false, message: 'Payment amount must be positive', code: 'INVALID_AMOUNT' });
      return;
    }

    const authoritativeOutstanding = loan.outstandingAmount;
    if (data.amount > authoritativeOutstanding) {
      res.status(422).json({ success: false, message: `Payment amount ₹${data.amount.toLocaleString('en-IN')} exceeds outstanding balance ₹${authoritativeOutstanding.toLocaleString('en-IN')}`, code: 'PAYMENT_EXCEEDS_OUTSTANDING', details: { amount: data.amount, outstandingAmount: authoritativeOutstanding } });
      return;
    }

    const paymentDate = new Date(data.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      res.status(422).json({ success: false, message: 'Invalid payment date', code: 'INVALID_DATE' });
      return;
    }

    const payment = await Payment.create([{ loanId: loan._id, utrNumber: data.utrNumber.trim(), amount: data.amount, paymentDate, recordedBy }], { session });
    const newTotalPaid = parseFloat((loan.totalPaid + data.amount).toFixed(2));
    const newOutstanding = parseFloat((loan.totalRepayment - newTotalPaid).toFixed(2));

    const updateFields: Record<string, unknown> = { totalPaid: newTotalPaid, outstandingAmount: newOutstanding };
    let autoClose = false;
    if (newOutstanding <= 0) {
      updateFields.status = LoanStatus.CLOSED;
      updateFields.outstandingAmount = 0;
      autoClose = true;
    }

    await LoanApplication.findByIdAndUpdate(loanId, { $set: updateFields }, { session });
    await session.commitTransaction();

    await AuditLog.create({
      actorId: new Types.ObjectId(recordedBy),
      actorRole,
      action: AuditAction.PAYMENT_RECORDED,
      entityType: EntityType.PAYMENT,
      entityId: new Types.ObjectId(payment[0]._id.toString()),
      newState: { utrNumber: data.utrNumber, amount: data.amount, newTotalPaid, newOutstanding },
      metadata: { loanId },
      ipAddress,
      userAgent,
    });

    if (autoClose) {
      await AuditLog.create({
        actorId: new Types.ObjectId(recordedBy),
        actorRole,
        action: AuditAction.LOAN_CLOSED,
        entityType: EntityType.LOAN_APPLICATION,
        entityId: new Types.ObjectId(loanId as string),
        previousState: { status: LoanStatus.DISBURSED },
        newState: { status: LoanStatus.CLOSED, totalPaid: newTotalPaid },
        metadata: { reason: 'FULLY_PAID' },
        ipAddress,
        userAgent,
      });
    }

    res.status(201).json({
      success: true,
      message: autoClose ? 'Payment recorded. Loan is now CLOSED.' : 'Payment recorded successfully',
      data: { payment: payment[0], loanUpdate: { totalPaid: newTotalPaid, outstandingAmount: autoClose ? 0 : newOutstanding, status: autoClose ? LoanStatus.CLOSED : LoanStatus.DISBURSED }, autoClose },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Record payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  } finally {
    session.endSession();
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find({ loanId: req.params.id }).populate('recordedBy', 'name email role').sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, message: 'Success', data: { payments } });
  } catch (error: any) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getTimeline = async (req: Request, res: Response) => {
  try {
    const loanId = req.params.id;
    const logs = await AuditLog.find({
      entityId: new Types.ObjectId(loanId as string),
      entityType: { $in: [EntityType.LOAN_APPLICATION, EntityType.PAYMENT] },
    })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email role')
      .lean();

    const paymentLogs = await AuditLog.find({
      'metadata.loanId': loanId,
      action: AuditAction.PAYMENT_RECORDED,
    })
      .sort({ createdAt: 1 })
      .populate('actorId', 'name email role')
      .lean();

    const timeline = [...logs, ...paymentLogs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.status(200).json({ success: true, message: 'Success', data: { timeline } });
  } catch (error: any) {
    console.error('Get timeline error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getSanctionQueue = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as any) || 1;
    const limit = parseInt(req.query.limit as any) || 20;
    const skip = (page - 1) * limit;
    const [applications, total] = await Promise.all([
      LoanApplication.find({ status: LoanStatus.APPLIED }).populate('borrowerId', 'name email pan monthlySalary employmentMode').populate('documentId').sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      LoanApplication.countDocuments({ status: LoanStatus.APPLIED }),
    ]);
    res.status(200).json({
      success: true,
      message: 'Success',
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get sanction queue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getDisbursementQueue = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as any) || 1;
    const limit = parseInt(req.query.limit as any) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status === 'DISBURSED' ? LoanStatus.DISBURSED : LoanStatus.SANCTIONED;
    const [applications, total] = await Promise.all([
      LoanApplication.find({ status }).populate('borrowerId', 'name email pan monthlySalary employmentMode').populate('documentId').sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      LoanApplication.countDocuments({ status }),
    ]);
    res.status(200).json({
      success: true,
      message: 'Success',
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get disbursement queue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getCollectionLoans = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as any) || 1;
    const limit = parseInt(req.query.limit as any) || 20;
    const skip = (page - 1) * limit;
    const [applications, total] = await Promise.all([
      LoanApplication.find({ status: LoanStatus.DISBURSED }).populate('borrowerId', 'name email pan monthlySalary employmentMode').populate('documentId').sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      LoanApplication.countDocuments({ status: LoanStatus.DISBURSED }),
    ]);
    res.status(200).json({
      success: true,
      message: 'Success',
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get collection loans error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};
