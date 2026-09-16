import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { AuditAction, EntityType, UserRole, EmploymentMode, IRuleResult } from '../types';
import { BRE_THRESHOLDS } from '../constants';
import { calculateAge } from '../utils/helpers';

// ------------------------------------------------------------------
// BRE (Business Rule Engine) UTILITIES
// ------------------------------------------------------------------

interface BREInput {
  dateOfBirth: Date;
  monthlySalary: number;
  pan: string;
  employmentMode: EmploymentMode;
}

export const evaluateBRE = (data: BREInput) => {
  const results: IRuleResult[] = [];

  // Age Rule
  const age = calculateAge(data.dateOfBirth);
  const agePassed = age >= BRE_THRESHOLDS.MIN_AGE && age <= BRE_THRESHOLDS.MAX_AGE;
  results.push({
    rule: 'AGE_CHECK',
    passed: agePassed,
    message: agePassed
      ? `Age ${age} is within eligible range (${BRE_THRESHOLDS.MIN_AGE}–${BRE_THRESHOLDS.MAX_AGE})`
      : `Age must be between ${BRE_THRESHOLDS.MIN_AGE} and ${BRE_THRESHOLDS.MAX_AGE} years. Current age: ${age}`,
  });

  // Salary Rule
  const salaryPassed = data.monthlySalary >= BRE_THRESHOLDS.MIN_SALARY;
  results.push({
    rule: 'MIN_SALARY',
    passed: salaryPassed,
    message: salaryPassed
      ? `Monthly salary ₹${data.monthlySalary.toLocaleString('en-IN')} meets minimum requirement`
      : `Monthly salary must be at least ₹${BRE_THRESHOLDS.MIN_SALARY.toLocaleString('en-IN')}. Current: ₹${data.monthlySalary.toLocaleString('en-IN')}`,
  });

  // PAN Rule
  const panPassed = BRE_THRESHOLDS.PAN_REGEX.test(data.pan);
  results.push({
    rule: 'PAN_VALID',
    passed: panPassed,
    message: panPassed
      ? 'PAN format is valid'
      : 'PAN must match format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)',
  });

  // Employment Rule
  const empPassed = data.employmentMode !== EmploymentMode.UNEMPLOYED;
  results.push({
    rule: 'EMPLOYMENT_MODE',
    passed: empPassed,
    message: empPassed
      ? `Employment mode "${data.employmentMode}" is eligible`
      : 'Unemployed applicants are not eligible for loans',
  });

  const eligible = results.every((r) => r.passed);
  return { eligible, reasons: results };
};

// ------------------------------------------------------------------
// ROUTE HANDLERS
// ------------------------------------------------------------------

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, pan, dateOfBirth, monthlySalary, employmentMode } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    // Update profile
    user.name = name;
    user.pan = pan.toUpperCase();
    user.dateOfBirth = new Date(dateOfBirth);
    user.monthlySalary = monthlySalary;
    user.employmentMode = employmentMode;
    user.profileCompleted = true;
    await user.save();

    // Run BRE
    const breResult = evaluateBRE({
      dateOfBirth: user.dateOfBirth,
      monthlySalary: user.monthlySalary,
      pan: user.pan!,
      employmentMode: user.employmentMode as EmploymentMode,
    });

    // Audit
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AuditLog.create({
      actorId: new Types.ObjectId(userId),
      actorRole: UserRole.BORROWER,
      action: AuditAction.PROFILE_UPDATED,
      entityType: EntityType.USER,
      entityId: new Types.ObjectId(userId),
      newState: { name, pan, dateOfBirth, monthlySalary, employmentMode },
      ipAddress,
      userAgent,
    });

    // Audit BRE result
    await AuditLog.create({
      actorId: new Types.ObjectId(userId),
      actorRole: UserRole.BORROWER,
      action: breResult.eligible ? AuditAction.BRE_PASSED : AuditAction.BRE_FAILED,
      entityType: EntityType.USER,
      entityId: new Types.ObjectId(userId),
      metadata: { breResult },
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON(),
        breResult,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const checkEligibility = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    if (!user.profileCompleted || !user.dateOfBirth || !user.monthlySalary || !user.pan || !user.employmentMode) {
      res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          eligible: false,
          profileCompleted: false,
          reasons: [{ rule: 'PROFILE_INCOMPLETE', passed: false, message: 'Please complete your profile first' }],
        },
      });
      return;
    }

    const breResult = evaluateBRE({
      dateOfBirth: user.dateOfBirth,
      monthlySalary: user.monthlySalary,
      pan: user.pan!,
      employmentMode: user.employmentMode as EmploymentMode,
    });

    res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        ...breResult,
        profileCompleted: true,
      },
    });
  } catch (error: any) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};
