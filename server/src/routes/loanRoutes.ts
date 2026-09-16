import { Router } from 'express';
import * as loanController from '../controllers/loanController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loanApplicationSchema, rejectLoanSchema, paymentSchema } from '../validators';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

// Borrower endpoints
router.post(
  '/calculate',
  authorize(UserRole.BORROWER),
  loanController.calculate
);

router.post(
  '/apply',
  authorize(UserRole.BORROWER),
  validate(loanApplicationSchema),
  loanController.create
);

router.get(
  '/me',
  authorize(UserRole.BORROWER),
  loanController.getMyApplications
);

// Operations endpoints
router.post(
  '/:id/sanction',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  loanController.sanction
);

router.post(
  '/:id/reject',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  validate(rejectLoanSchema),
  loanController.reject
);

router.post(
  '/:id/disburse',
  authorize(UserRole.DISBURSEMENT, UserRole.ADMIN),
  loanController.disburse
);

router.post(
  '/:id/payments',
  authorize(UserRole.COLLECTION, UserRole.ADMIN),
  validate(paymentSchema),
  loanController.recordPayment
);

router.get(
  '/:id/payments',
  authorize(UserRole.COLLECTION, UserRole.ADMIN, UserRole.BORROWER),
  loanController.getPayments
);

router.get(
  '/:id/timeline',
  loanController.getTimeline
);

// Get by ID (Keep last)
router.get(
  '/:id',
  loanController.getById
);

export default router;
