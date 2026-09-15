import mongoose, { Schema, Document } from 'mongoose';
import { IUser, UserRole, EmploymentMode } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document { }

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned by default in queries
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.BORROWER,
      required: true,
    },
    pan: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
    },
    dateOfBirth: {
      type: Date,
    },
    monthlySalary: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
    },
    employmentMode: {
      type: String,
      enum: Object.values(EmploymentMode),
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ role: 1 });

export const User = mongoose.model<IUserDocument>('User', userSchema);
