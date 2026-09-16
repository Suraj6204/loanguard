import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { AuditLog } from '../models/AuditLog';
import { DOCUMENT_CONFIG } from '../constants';
import { DocumentValidationStatus, IValidationStepResult, AuditAction, EntityType } from '../types';
import { computeSHA256, getFileExtension } from '../utils/helpers';

// ------------------------------------------------------------------
// ROUTE HANDLERS
// ------------------------------------------------------------------

export const upload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded', code: 'FILE_REQUIRED' });
      return;
    }

    const file = req.file;
    const uploadedBy = req.user!.userId;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const steps: IValidationStepResult[] = [];
    let overallValid = true;

    // 1. Size
    const sizeValid = file.size <= DOCUMENT_CONFIG.MAX_SIZE_BYTES;
    steps.push({ step: 'SIZE_CHECK', passed: sizeValid, message: sizeValid ? 'Size OK' : 'Size exceeds limit' });
    if (!sizeValid) overallValid = false;

    // 2. Extension
    const extension = getFileExtension(file.originalname);
    const extValid = (DOCUMENT_CONFIG.ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
    steps.push({ step: 'EXTENSION_CHECK', passed: extValid, message: extValid ? 'Ext OK' : 'Ext invalid' });
    if (!extValid) overallValid = false;

    // 3. MIME
    const mimeValid = (DOCUMENT_CONFIG.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype);
    steps.push({ step: 'MIME_CHECK', passed: mimeValid, message: mimeValid ? 'MIME OK' : 'MIME invalid' });
    if (!mimeValid) overallValid = false;

    // 4. Magic Byte
    let detectedType: { ext: string; mime: string } | undefined;
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const result = await fileTypeFromBuffer(file.buffer);
      detectedType = result ?? undefined;

      if (detectedType) {
        const magicValid = (DOCUMENT_CONFIG.ALLOWED_MIME_TYPES as readonly string[]).includes(detectedType.mime);
        steps.push({ step: 'MAGIC_BYTE_CHECK', passed: magicValid, message: magicValid ? 'Magic OK' : 'Magic mismatch' });
        if (!magicValid) overallValid = false;
      } else {
        const isPdfHeader = file.buffer.length >= 4 && file.buffer[0] === 0x25 && file.buffer[1] === 0x50 && file.buffer[2] === 0x44 && file.buffer[3] === 0x46;
        if (isPdfHeader) {
          steps.push({ step: 'MAGIC_BYTE_CHECK', passed: true, message: 'PDF header verified' });
        } else {
          steps.push({ step: 'MAGIC_BYTE_CHECK', passed: false, message: 'Unknown signature' });
          overallValid = false;
        }
      }
    } catch {
      steps.push({ step: 'MAGIC_BYTE_CHECK', passed: false, message: 'Error' });
      overallValid = false;
    }

    // 5. Parseability
    try {
      if (file.mimetype === 'application/pdf' || detectedType?.mime === 'application/pdf') {
        const content = file.buffer.toString('ascii', 0, Math.min(1024, file.buffer.length));
        const hasPdfHeader = content.includes('%PDF');
        steps.push({ step: 'PARSEABILITY_CHECK', passed: hasPdfHeader, message: hasPdfHeader ? 'PDF OK' : 'Invalid PDF' });
        if (!hasPdfHeader) overallValid = false;
      } else if (detectedType?.mime === 'image/jpeg' || detectedType?.mime === 'image/png') {
        const imageValid = file.size >= 100;
        steps.push({ step: 'PARSEABILITY_CHECK', passed: imageValid, message: imageValid ? 'Img OK' : 'Img corrupt' });
        if (!imageValid) overallValid = false;
      } else {
        steps.push({ step: 'PARSEABILITY_CHECK', passed: true, message: 'Parse OK' });
      }
    } catch {
      steps.push({ step: 'PARSEABILITY_CHECK', passed: false, message: 'Parse Error' });
      overallValid = false;
    }

    // 6. SHA-256
    const sha256 = computeSHA256(file.buffer);
    steps.push({ step: 'SHA256_FINGERPRINT', passed: true, message: `SHA-256: ${sha256}` });

    // 7. Duplicate check
    const existingDoc = await DocumentModel.findOne({ sha256 });
    if (existingDoc) {
      steps.push({ step: 'DUPLICATE_CHECK', passed: false, message: 'Duplicate found' });
      await AuditLog.create({
        actorId: new Types.ObjectId(uploadedBy),
        actorRole: 'Borrower',
        action: AuditAction.DOCUMENT_VALIDATION_FAILED,
        entityType: EntityType.DOCUMENT,
        metadata: { reason: 'DUPLICATE_SHA256', sha256 },
        ipAddress,
        userAgent,
      });
      res.status(409).json({ success: false, message: 'An identical document has already been uploaded', code: 'DUPLICATE_DOCUMENT' });
      return;
    }

    steps.push({ step: 'DUPLICATE_CHECK', passed: true, message: 'No duplicate' });

    if (!overallValid) {
      await AuditLog.create({
        actorId: new Types.ObjectId(uploadedBy),
        actorRole: 'Borrower',
        action: AuditAction.DOCUMENT_VALIDATION_FAILED,
        entityType: EntityType.DOCUMENT,
        metadata: { steps, originalName: file.originalname },
        ipAddress,
        userAgent,
      });
      res.status(422).json({ success: false, message: 'Document validation failed', code: 'DOCUMENT_VALIDATION_FAILED', details: { validationResults: { steps, overall: false } } });
      return;
    }

    // 8. Generate local storage key (for compatibility, not strictly needed since data is in Mongo now)
    const storageKey = `local-mongo/${uploadedBy}/${uuidv4()}${extension}`;

    // 9. Save DB with Buffer data
    const document = await DocumentModel.create({
      uploadedBy,
      storageKey,
      originalName: file.originalname,
      mimeType: detectedType?.mime || file.mimetype,
      size: file.size,
      sha256,
      fileData: file.buffer, // Save raw buffer data to DB
      validationStatus: DocumentValidationStatus.VALID,
      validationResults: { steps, overall: true },
    });

    await AuditLog.create({
      actorId: new Types.ObjectId(uploadedBy),
      actorRole: 'Borrower',
      action: AuditAction.DOCUMENT_VALIDATED,
      entityType: EntityType.DOCUMENT,
      entityId: new Types.ObjectId(document._id.toString()),
      newState: { originalName: file.originalname, mimeType: document.mimeType, size: file.size, sha256 },
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded and validated successfully',
      data: { document },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found', code: 'DOCUMENT_NOT_FOUND' });
      return;
    }

    if (requesterRole === 'Borrower' && document.uploadedBy.toString() !== requesterId) {
      res.status(403).json({ success: false, message: 'Access denied', code: 'FORBIDDEN' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        document: document.toJSON(), // No signedUrl anymore
      },
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const getMyDocuments = async (req: Request, res: Response) => {
  try {
    const documents = await DocumentModel.find({ uploadedBy: req.user!.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({
      success: true,
      message: 'Success',
      data: { documents },
    });
  } catch (error: any) {
    console.error('Get my documents error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error', code: 'INTERNAL_ERROR' });
  }
};

export const view = async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    // Explicitly select the +fileData buffer so we can send it
    const document = await DocumentModel.findById(documentId).select('+fileData');
    if (!document || !document.fileData) {
      res.status(404).send('Document not found');
      return;
    }

    if (requesterRole === 'Borrower' && document.uploadedBy.toString() !== requesterId) {
      res.status(403).send('Access denied');
      return;
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    res.send(document.fileData);
  } catch (error: any) {
    console.error('View document error:', error);
    res.status(500).send('Internal server error');
  }
};
