import { Router } from 'express';
import * as documentController from '../controllers/documentController';
import { authenticate, authorize } from '../middleware/auth';
import multer from 'multer';
import { DOCUMENT_CONFIG } from '../constants';
import { UserRole } from '../types';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_CONFIG.MAX_SIZE_BYTES },
});

router.use(authenticate);

router.post(
  '/upload',
  authorize(UserRole.BORROWER),
  upload.single('file'),
  documentController.upload
);

router.get(
  '/me',
  authorize(UserRole.BORROWER),
  documentController.getMyDocuments
);

router.get(
  '/:id',
  documentController.getById
);

router.get(
  '/:id/view',
  documentController.view
);

export default router;
