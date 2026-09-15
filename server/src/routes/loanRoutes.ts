import { Router } from 'express';
import { loanController } from '../controllers/loanController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loanApplicationSchema, rejectLoanSchema, paymentSchema } from '../validators';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

// Borrower endpoints
router.post(
  '/calculate',
  (req, res, next) => loanController.calculate(req, res, next)
);

router.post(
  '/',
  authorize(UserRole.BORROWER),
  validate(loanApplicationSchema),
  (req, res, next) => loanController.create(req, res, next)
);

router.get(
  '/me',
  authorize(UserRole.BORROWER),
  (req, res, next) => loanController.getMyApplications(req, res, next)
);

// Loan details & timeline (accessible by authenticated users, resource-level auth in service)
router.get(
  '/:id',
  (req, res, next) => loanController.getById(req, res, next)
);

router.get(
  '/:id/timeline',
  (req, res, next) => loanController.getTimeline(req, res, next)
);

router.get(
  '/:id/payments',
  (req, res, next) => loanController.getPayments(req, res, next)
);

// Sanction operations
router.post(
  '/:id/sanction',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  (req, res, next) => loanController.sanction(req, res, next)
);

router.post(
  '/:id/reject',
  authorize(UserRole.SANCTION, UserRole.ADMIN),
  validate(rejectLoanSchema),
  (req, res, next) => loanController.reject(req, res, next)
);

// Disbursement operations
router.post(
  '/:id/disburse',
  authorize(UserRole.DISBURSEMENT, UserRole.ADMIN),
  (req, res, next) => loanController.disburse(req, res, next)
);

// Collection operations
router.post(
  '/:id/payments',
  authorize(UserRole.COLLECTION, UserRole.ADMIN),
  validate(paymentSchema),
  (req, res, next) => loanController.recordPayment(req, res, next)
);

export default router;
