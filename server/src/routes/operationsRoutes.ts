import { Router } from 'express';
import * as loanController from '../controllers/loanController';
import * as adminController from '../controllers/adminController';
import * as auditController from '../controllers/auditController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

// Operations - Sanction queue
router.get(
  '/sanction/loans',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  loanController.getSanctionQueue
);

// Operations - Disbursement queue
router.get(
  '/disbursement/loans',
  authorize(UserRole.DISBURSEMENT, UserRole.ADMIN),
  loanController.getDisbursementQueue
);

// Operations - Collection
router.get(
  '/collection/loans',
  authorize(UserRole.COLLECTION, UserRole.ADMIN),
  loanController.getCollectionLoans
);

// Operations - Sales leads
router.get(
  '/sales/leads',
  authorize(UserRole.SALES, UserRole.ADMIN),
  adminController.getSalesLeads
);

// Dashboard stats
router.get(
  '/dashboard',
  authorize(UserRole.ADMIN),
  adminController.getDashboard
);

// Audit logs
router.get(
  '/audit-logs',
  authorize(UserRole.ADMIN),
  auditController.getAll
);

export default router;
