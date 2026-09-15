import mongoose from 'mongoose';
import { Payment } from '../models/Payment';
import { LoanApplication } from '../models/LoanApplication';
import { LoanStatus, UserRole, AuditAction, EntityType } from '../types';
import { auditService } from './auditService';
import { AppError } from '../middleware/errorHandler';

class PaymentService {
  /**
   * Record a payment using MongoDB transactions for concurrency protection.
   * This prevents race conditions when two collection executives submit
   * payments for the same loan simultaneously.
   */
  async recordPayment(
    loanId: string,
    data: { utrNumber: string; amount: number; paymentDate: string },
    recordedBy: string,
    actorRole: UserRole,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      // 1. Find loan with session lock
      const loan = await LoanApplication.findById(loanId).session(session);
      if (!loan) {
        throw new AppError('Loan not found', 404, 'LOAN_NOT_FOUND');
      }

      // 2. Verify loan is in DISBURSED status
      if (loan.status !== LoanStatus.DISBURSED) {
        throw new AppError(
          `Payments can only be recorded for DISBURSED loans. Current status: ${loan.status}`,
          422,
          'INVALID_LOAN_STATUS',
          { currentStatus: loan.status }
        );
      }

      // 3. Validate UTR
      if (!data.utrNumber || data.utrNumber.trim().length === 0) {
        throw new AppError('UTR number is required', 422, 'UTR_REQUIRED');
      }

      // 4. Validate amount
      if (!data.amount || data.amount <= 0) {
        throw new AppError('Payment amount must be positive', 422, 'INVALID_AMOUNT');
      }

      // 5. Read authoritative outstanding from DB (within transaction)
      const authoritativeOutstanding = loan.outstandingAmount;

      // 6. Prevent overpayment
      if (data.amount > authoritativeOutstanding) {
        throw new AppError(
          `Payment amount ₹${data.amount.toLocaleString('en-IN')} exceeds outstanding balance ₹${authoritativeOutstanding.toLocaleString('en-IN')}`,
          422,
          'PAYMENT_EXCEEDS_OUTSTANDING',
          {
            amount: data.amount,
            outstandingAmount: authoritativeOutstanding,
          }
        );
      }

      // 7. Validate payment date
      const paymentDate = new Date(data.paymentDate);
      if (isNaN(paymentDate.getTime())) {
        throw new AppError('Invalid payment date', 422, 'INVALID_DATE');
      }

      // 8. Create payment document (UTR uniqueness enforced by DB index)
      const payment = await Payment.create(
        [
          {
            loanId: loan._id,
            utrNumber: data.utrNumber.trim(),
            amount: data.amount,
            paymentDate,
            recordedBy,
          },
        ],
        { session }
      );

      // 9. Atomically update loan totals
      const newTotalPaid = parseFloat((loan.totalPaid + data.amount).toFixed(2));
      const newOutstanding = parseFloat((loan.totalRepayment - newTotalPaid).toFixed(2));

      const updateFields: Record<string, unknown> = {
        totalPaid: newTotalPaid,
        outstandingAmount: newOutstanding,
      };

      // 10. Auto-close if fully paid
      let autoClose = false;
      if (newOutstanding <= 0) {
        updateFields.status = LoanStatus.CLOSED;
        updateFields.outstandingAmount = 0;
        autoClose = true;
      }

      await LoanApplication.findByIdAndUpdate(
        loanId,
        { $set: updateFields },
        { session }
      );

      // 11. Commit transaction
      await session.commitTransaction();

      // 12. Audit (outside transaction — non-critical)
      await auditService.log({
        actorId: recordedBy,
        actorRole,
        action: AuditAction.PAYMENT_RECORDED,
        entityType: EntityType.PAYMENT,
        entityId: payment[0]._id.toString(),
        newState: {
          utrNumber: data.utrNumber,
          amount: data.amount,
          newTotalPaid,
          newOutstanding,
        },
        metadata: { loanId },
        ipAddress,
        userAgent,
      });

      if (autoClose) {
        await auditService.log({
          actorId: recordedBy,
          actorRole,
          action: AuditAction.LOAN_CLOSED,
          entityType: EntityType.LOAN_APPLICATION,
          entityId: loanId,
          previousState: { status: LoanStatus.DISBURSED },
          newState: { status: LoanStatus.CLOSED, totalPaid: newTotalPaid },
          metadata: { reason: 'FULLY_PAID' },
          ipAddress,
          userAgent,
        });
      }

      return {
        payment: payment[0],
        loanUpdate: {
          totalPaid: newTotalPaid,
          outstandingAmount: autoClose ? 0 : newOutstanding,
          status: autoClose ? LoanStatus.CLOSED : LoanStatus.DISBURSED,
        },
        autoClose,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getByLoanId(loanId: string) {
    return Payment.find({ loanId })
      .populate('recordedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getRecentPayments(limit = 10) {
    return Payment.find()
      .populate('recordedBy', 'name email role')
      .populate('loanId', 'principal totalRepayment status borrowerId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export const paymentService = new PaymentService();
