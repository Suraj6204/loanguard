import { Router } from 'express';
import { loanController } from '../controllers/loanController';
import { adminController } from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

// Operations - Sanction queue
router.get(
  '/sanction/loans',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  (req, res, next) => loanController.getSanctionQueue(req, res, next)
);

// Operations - Disbursement queue
router.get(
  '/disbursement/loans',
  authorize(UserRole.DISBURSEMENT, UserRole.ADMIN),
  (req, res, next) => loanController.getDisbursementQueue(req, res, next)
);

// Operations - Collection
router.get(
  '/collection/loans',
  authorize(UserRole.COLLECTION, UserRole.ADMIN),
  (req, res, next) => loanController.getCollectionLoans(req, res, next)
);

// Operations - Sales leads
router.get(
  '/sales/leads',
  authorize(UserRole.SALES, UserRole.ADMIN),
  (req, res, next) => adminController.getSalesLeads(req, res, next)
);

// Dashboard stats
router.get(
  '/dashboard',
  authorize(UserRole.ADMIN),
  (req, res, next) => adminController.getDashboard(req, res, next)
);

// Audit logs
router.get(
  '/audit-logs',
  authorize(UserRole.ADMIN),
  (req, res, next) => adminController.getAuditLogs(req, res, next)
);

export default router;
