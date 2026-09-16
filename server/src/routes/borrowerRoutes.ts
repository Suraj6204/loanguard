import { Router } from 'express';
import * as borrowerController from '../controllers/borrowerController';
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
  borrowerController.updateProfile
);

router.get(
  '/eligibility',
  authorize(UserRole.BORROWER),
  borrowerController.checkEligibility
);

export default router;
