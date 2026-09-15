import mongoose, { Schema, Document } from 'mongoose';
import { ILoanApplication, LoanStatus } from '../types';

export interface ILoanApplicationDocument extends Omit<ILoanApplication, '_id'>, Document { }

const loanApplicationSchema = new Schema<ILoanApplicationDocument>(
  {
    borrowerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    principal: {
      type: Number,
      required: true,
      min: [50000, 'Minimum loan amount is ₹50,000'],
      max: [500000, 'Maximum loan amount is ₹5,00,000'],
    },
    tenureDays: {
      type: Number,
      required: true,
      min: [30, 'Minimum tenure is 30 days'],
      max: [365, 'Maximum tenure is 365 days'],
    },
    annualInterestRate: {
      type: Number,
      required: true,
      default: 12,
    },
    interestAmount: {
      type: Number,
      required: true,
    },
    totalRepayment: {
      type: Number,
      required: true,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(LoanStatus),
      default: LoanStatus.APPLIED,
      required: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    sanctionedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sanctionedAt: Date,
    disbursedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    disbursedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
loanApplicationSchema.index({ borrowerId: 1, status: 1 });
loanApplicationSchema.index({ status: 1 });
loanApplicationSchema.index({ createdAt: -1 });

export const LoanApplication = mongoose.model<ILoanApplicationDocument>(
  'LoanApplication',
  loanApplicationSchema
);
