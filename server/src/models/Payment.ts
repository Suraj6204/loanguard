import mongoose, { Schema, Document } from 'mongoose';
import { IPayment } from '../types';

export interface IPaymentDocument extends Omit<IPayment, '_id'>, Document { }

const paymentSchema = new Schema<IPaymentDocument>(
  {
    loanId: {
      type: Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      index: true,
    },
    utrNumber: {
      type: String,
      required: [true, 'UTR number is required'],
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be positive'],
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
paymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model<IPaymentDocument>('Payment', paymentSchema);
