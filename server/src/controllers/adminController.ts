import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { LoanApplication } from '../models/LoanApplication';
import { auditService } from '../services/auditService';
import { paymentService } from '../services/paymentService';
import { loanService } from '../services/loanService';
import { sendSuccess, sendPaginated } from '../utils/response';
import { LoanStatus, AuditAction, EntityType } from '../types';

export class AdminController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        action: req.query.action as AuditAction | undefined,
        entityType: req.query.entityType as EntityType | undefined,
        actorId: req.query.actorId as string | undefined,
      };

      const { logs, total } = await auditService.getAll(filters, page, limit);
      sendPaginated(res, logs, total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getSalesLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get borrowers who registered
      const [users, total] = await Promise.all([
        User.find({ role: 'Borrower' })
          .select('name email profileCompleted createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments({ role: 'Borrower' }),
      ]);

      // Enrich with application status
      const userIds = users.map((u) => u._id);
      const applications = await LoanApplication.find({
        borrowerId: { $in: userIds },
      })
        .select('borrowerId status')
        .lean();

      const appMap = new Map<string, string>();
      applications.forEach((app) => {
        appMap.set(app.borrowerId.toString(), app.status);
      });

      // Get document uploads for these users
      const documents = await mongoose.model('Document').find({
        uploadedBy: { $in: userIds },
      }).select('uploadedBy').lean() as { uploadedBy: any }[];
      const docSet = new Set(documents.map((d: any) => d.uploadedBy.toString()));

      const enrichedUsers = users.map((user) => {
        const appStatus = appMap.get(user._id.toString());
        let finalStatus = 'NOT_STARTED';
        if (appStatus) {
          finalStatus = appStatus;
        } else if (user.profileCompleted) {
          if (docSet.has(user._id.toString())) {
            finalStatus = 'DOCUMENT_UPLOADED';
          } else {
            finalStatus = 'PENDING_DOCUMENT';
          }
        }
        return {
          ...user,
          applicationStatus: finalStatus,
        };
      });

      sendPaginated(res, enrichedUsers, total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await loanService.getDashboardStats();
      const recentPayments = await paymentService.getRecentPayments(5);
      const totalBorrowers = await User.countDocuments({ role: 'Borrower' });
      const profileCompletedBorrowers = await User.countDocuments({
        role: 'Borrower',
        profileCompleted: true,
      });

      sendSuccess(res, {
        stats,
        recentPayments,
        totalBorrowers,
        profileCompletedBorrowers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
