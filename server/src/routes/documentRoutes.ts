import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/documentController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import { DOCUMENT_CONFIG } from '../constants';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_CONFIG.MAX_SIZE_BYTES },
});

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize(UserRole.BORROWER),
  upload.single('file'),
  (req, res, next) => documentController.upload(req, res, next)
);

router.get(
  '/me',
  authorize(UserRole.BORROWER),
  (req, res, next) => documentController.getMyDocuments(req, res, next)
);

router.get(
  '/:id',
  (req, res, next) => documentController.getById(req, res, next)
);

export default router;
