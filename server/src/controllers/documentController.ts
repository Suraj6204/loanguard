import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/documentService';
import { sendCreated, sendSuccess } from '../utils/response';

export class DocumentController {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
          code: 'FILE_REQUIRED',
        });
        return;
      }

      const document = await documentService.processUpload(
        req.file,
        req.user!.userId,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      sendCreated(res, { document }, 'Document uploaded and validated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await documentService.getById(
        req.params.id,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, { document });
    } catch (error) {
      next(error);
    }
  }

  async getMyDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const documents = await documentService.getByUploader(req.user!.userId);
      sendSuccess(res, { documents });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
