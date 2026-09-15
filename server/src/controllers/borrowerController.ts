import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { breService } from '../services/breService';
import { auditService } from '../services/auditService';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { AuditAction, EntityType, UserRole, EmploymentMode } from '../types';

export class BorrowerController {
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { name, pan, dateOfBirth, monthlySalary, employmentMode } = req.body;

      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

      // Update profile
      user.name = name;
      user.pan = pan.toUpperCase();
      user.dateOfBirth = new Date(dateOfBirth);
      user.monthlySalary = monthlySalary;
      user.employmentMode = employmentMode;
      user.profileCompleted = true;
      await user.save();

      // Run BRE
      const breResult = breService.evaluate({
        dateOfBirth: user.dateOfBirth,
        monthlySalary: user.monthlySalary,
        pan: user.pan!,
        employmentMode: user.employmentMode as EmploymentMode,
      });

      // Audit
      await auditService.log({
        actorId: userId,
        actorRole: UserRole.BORROWER,
        action: AuditAction.PROFILE_UPDATED,
        entityType: EntityType.USER,
        entityId: userId,
        newState: { name, pan, dateOfBirth, monthlySalary, employmentMode },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Audit BRE result
      await auditService.log({
        actorId: userId,
        actorRole: UserRole.BORROWER,
        action: breResult.eligible ? AuditAction.BRE_PASSED : AuditAction.BRE_FAILED,
        entityType: EntityType.USER,
        entityId: userId,
        metadata: { breResult },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, {
        user: user.toJSON(),
        breResult,
      }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

      if (!user.profileCompleted || !user.dateOfBirth || !user.monthlySalary || !user.pan || !user.employmentMode) {
        sendSuccess(res, {
          eligible: false,
          profileCompleted: false,
          reasons: [{ rule: 'PROFILE_INCOMPLETE', passed: false, message: 'Please complete your profile first' }],
        });
        return;
      }

      const breResult = breService.evaluate({
        dateOfBirth: user.dateOfBirth,
        monthlySalary: user.monthlySalary,
        pan: user.pan!,
        employmentMode: user.employmentMode as EmploymentMode,
      });

      sendSuccess(res, {
        ...breResult,
        profileCompleted: true,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const borrowerController = new BorrowerController();
