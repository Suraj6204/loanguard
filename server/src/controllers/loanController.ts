import { Request, Response, NextFunction } from 'express';
import { loanService } from '../services/loanService';
import { paymentService } from '../services/paymentService';
import { auditService } from '../services/auditService';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { UserRole, LoanStatus } from '../types';

export class LoanController {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const { principal, tenureDays } = req.body;
      const result = loanService.calculateLoan(principal, tenureDays);
      sendSuccess(res, result, 'Loan calculation');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await loanService.createApplication(
        req.user!.userId,
        req.body,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );
      sendCreated(res, { application }, 'Loan application created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMyApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const applications = await loanService.getMyApplications(req.user!.userId);
      sendSuccess(res, { applications });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await loanService.getById(
        req.params.id,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, { application });
    } catch (error) {
      next(error);
    }
  }

  async sanction(req: Request, res: Response, next: NextFunction) {
    try {
      const loan = await loanService.sanctionLoan(
        req.params.id,
        req.user!.userId,
        req.user!.role as UserRole,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );
      sendSuccess(res, { loan }, 'Loan sanctioned successfully');
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const loan = await loanService.rejectLoan(
        req.params.id,
        req.user!.userId,
        req.user!.role as UserRole,
        req.body.reason,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );
      sendSuccess(res, { loan }, 'Loan rejected');
    } catch (error) {
      next(error);
    }
  }

  async disburse(req: Request, res: Response, next: NextFunction) {
    try {
      const loan = await loanService.disburseLoan(
        req.params.id,
        req.user!.userId,
        req.user!.role as UserRole,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );
      sendSuccess(res, { loan }, 'Loan disbursed successfully');
    } catch (error) {
      next(error);
    }
  }

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paymentService.recordPayment(
        req.params.id,
        req.body,
        req.user!.userId,
        req.user!.role as UserRole,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );
      sendCreated(res, result, result.autoClose ? 'Payment recorded. Loan is now CLOSED.' : 'Payment recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const payments = await paymentService.getByLoanId(req.params.id);
      sendSuccess(res, { payments });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const timeline = await auditService.getTimeline(req.params.id);
      sendSuccess(res, { timeline });
    } catch (error) {
      next(error);
    }
  }

  // Operations endpoints
  async getSanctionQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { applications, total } = await loanService.getByStatus(LoanStatus.APPLIED, page, limit);
      sendPaginated(res, applications, total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getDisbursementQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const statusFilter = req.query.status === 'DISBURSED' ? LoanStatus.DISBURSED : LoanStatus.SANCTIONED;
      const { applications, total } = await loanService.getByStatus(statusFilter, page, limit);
      sendPaginated(res, applications, total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getCollectionLoans(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { applications, total } = await loanService.getByStatus(LoanStatus.DISBURSED, page, limit);
      sendPaginated(res, applications, total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await loanService.getDashboardStats();
      sendSuccess(res, { stats });
    } catch (error) {
      next(error);
    }
  }
}

export const loanController = new LoanController();
