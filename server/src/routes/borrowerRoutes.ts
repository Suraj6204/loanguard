import { Router } from 'express';
import { borrowerController } from '../controllers/borrowerController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { profileSchema } from '../validators';
import { UserRole } from '../types';

const router = Router();

// All routes require authentication and Borrower role
router.use(authenticate);

router.post(
  '/profile',
  authorize(UserRole.BORROWER),
  validate(profileSchema),
  (req, res, next) => borrowerController.updateProfile(req, res, next)
);

router.get(
  '/eligibility',
  authorize(UserRole.BORROWER),
  (req, res, next) => borrowerController.checkEligibility(req, res, next)
);

export default router;
