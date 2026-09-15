import { z } from 'zod';
import { EmploymentMode } from '../types';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(100),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g., ABCDE1234F)'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  monthlySalary: z.number().positive('Salary must be positive'),
  employmentMode: z.nativeEnum(EmploymentMode),
});

export const loanApplicationSchema = z.object({
  principal: z
    .number()
    .min(50000, 'Minimum loan amount is ₹50,000')
    .max(500000, 'Maximum loan amount is ₹5,00,000'),
  tenureDays: z
    .number()
    .int('Tenure must be a whole number')
    .min(30, 'Minimum tenure is 30 days')
    .max(365, 'Maximum tenure is 365 days'),
  documentId: z.string().min(1, 'Document ID is required'),
});

export const rejectLoanSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(500),
});

export const paymentSchema = z.object({
  utrNumber: z.string().min(1, 'UTR number is required').max(50),
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
});
