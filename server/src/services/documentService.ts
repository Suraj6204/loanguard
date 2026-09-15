import { v4 as uuidv4 } from 'uuid';
import { DocumentModel } from '../models/Document';
import { DOCUMENT_CONFIG } from '../constants';
import {
  DocumentValidationStatus,
  IValidationStepResult,
  AuditAction,
  EntityType,
} from '../types';
import { computeSHA256, getFileExtension } from '../utils/helpers';
import { storageService } from './storageService';
import { auditService } from './auditService';
import { AppError } from '../middleware/errorHandler';

class DocumentService {
  /**
   * Multi-layer document validation pipeline:
   * 1. Size validation
   * 2. Extension validation
   * 3. MIME type validation (from browser)
   * 4. Magic byte validation (file-type library)
   * 5. SHA-256 fingerprint + duplicate detection
   * 6. Upload to Supabase
   * 7. Persist metadata
   */
  async processUpload(
    file: Express.Multer.File,
    uploadedBy: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const steps: IValidationStepResult[] = [];
    let overallValid = true;

    // Step 1: Size validation
    const sizeValid = file.size <= DOCUMENT_CONFIG.MAX_SIZE_BYTES;
    steps.push({
      step: 'SIZE_CHECK',
      passed: sizeValid,
      message: sizeValid
        ? `File size ${(file.size / (1024 * 1024)).toFixed(2)} MB is within limit`
        : `File size exceeds ${DOCUMENT_CONFIG.MAX_SIZE_BYTES / (1024 * 1024)} MB limit`,
    });
    if (!sizeValid) overallValid = false;

    // Step 2: Extension validation
    const extension = getFileExtension(file.originalname);
    const extValid = DOCUMENT_CONFIG.ALLOWED_EXTENSIONS.includes(extension);
    steps.push({
      step: 'EXTENSION_CHECK',
      passed: extValid,
      message: extValid
        ? `Extension "${extension}" is allowed`
        : `Extension "${extension}" is not allowed. Allowed: ${DOCUMENT_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`,
    });
    if (!extValid) overallValid = false;

    // Step 3: Browser MIME type validation
    const mimeValid = DOCUMENT_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype);
    steps.push({
      step: 'MIME_CHECK',
      passed: mimeValid,
      message: mimeValid
        ? `MIME type "${file.mimetype}" is allowed`
        : `MIME type "${file.mimetype}" is not allowed`,
    });
    if (!mimeValid) overallValid = false;

    // Step 4: Magic byte validation using file-type
    let detectedType: { ext: string; mime: string } | undefined;
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const result = await fileTypeFromBuffer(file.buffer);
      detectedType = result ?? undefined;

      if (detectedType) {
        const magicValid = DOCUMENT_CONFIG.ALLOWED_MIME_TYPES.includes(detectedType.mime);
        steps.push({
          step: 'MAGIC_BYTE_CHECK',
          passed: magicValid,
          message: magicValid
            ? `File signature detected: ${detectedType.mime} (${detectedType.ext})`
            : `File signature mismatch: detected ${detectedType.mime}, expected one of ${DOCUMENT_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`,
        });
        if (!magicValid) overallValid = false;
      } else {
        // Could not detect — check if it might be a text-based PDF (some PDFs aren't detected)
        const isPdfHeader = file.buffer.length >= 4 &&
          file.buffer[0] === 0x25 &&
          file.buffer[1] === 0x50 &&
          file.buffer[2] === 0x44 &&
          file.buffer[3] === 0x46;

        if (isPdfHeader) {
          steps.push({
            step: 'MAGIC_BYTE_CHECK',
            passed: true,
            message: 'PDF header (%PDF) detected via manual check',
          });
        } else {
          steps.push({
            step: 'MAGIC_BYTE_CHECK',
            passed: false,
            message: 'Unable to detect file type from binary signature. File may be corrupted.',
          });
          overallValid = false;
        }
      }
    } catch (error) {
      steps.push({
        step: 'MAGIC_BYTE_CHECK',
        passed: false,
        message: 'Magic byte validation failed due to internal error',
      });
      overallValid = false;
    }

    // Step 5: Corruption / parseability check
    try {
      if (file.mimetype === 'application/pdf' || detectedType?.mime === 'application/pdf') {
        // Check for PDF structure markers
        const content = file.buffer.toString('ascii', 0, Math.min(1024, file.buffer.length));
        const hasPdfHeader = content.includes('%PDF');
        steps.push({
          step: 'PARSEABILITY_CHECK',
          passed: hasPdfHeader,
          message: hasPdfHeader
            ? 'PDF structure header verified'
            : 'File claims to be PDF but lacks proper PDF header structure',
        });
        if (!hasPdfHeader) overallValid = false;
      } else if (
        detectedType?.mime === 'image/jpeg' ||
        detectedType?.mime === 'image/png'
      ) {
        // Images: check minimum size (corrupted images are often tiny)
        const minImageSize = 100; // bytes
        const imageValid = file.size >= minImageSize;
        steps.push({
          step: 'PARSEABILITY_CHECK',
          passed: imageValid,
          message: imageValid
            ? 'Image file size appears valid'
            : 'Image file is suspiciously small, possibly corrupted',
        });
        if (!imageValid) overallValid = false;
      } else {
        steps.push({
          step: 'PARSEABILITY_CHECK',
          passed: true,
          message: 'Parseability check passed (no specific parser for this type)',
        });
      }
    } catch {
      steps.push({
        step: 'PARSEABILITY_CHECK',
        passed: false,
        message: 'File parseability check failed',
      });
      overallValid = false;
    }

    // Step 6: SHA-256 fingerprint
    const sha256 = computeSHA256(file.buffer);
    steps.push({
      step: 'SHA256_FINGERPRINT',
      passed: true,
      message: `SHA-256: ${sha256}`,
    });

    // Step 7: Duplicate detection
    const existingDoc = await DocumentModel.findOne({ sha256 });
    if (existingDoc) {
      steps.push({
        step: 'DUPLICATE_CHECK',
        passed: false,
        message: 'An identical document has already been uploaded (SHA-256 match)',
      });
      overallValid = false;

      // Audit the failed upload
      await auditService.log({
        actorId: uploadedBy,
        actorRole: 'Borrower',
        action: AuditAction.DOCUMENT_VALIDATION_FAILED,
        entityType: EntityType.DOCUMENT,
        metadata: { reason: 'DUPLICATE_SHA256', sha256 },
        ipAddress,
        userAgent,
      });

      throw new AppError(
        'An identical document has already been uploaded',
        409,
        'DUPLICATE_DOCUMENT',
        { sha256, existingDocumentId: existingDoc._id.toString() }
      );
    }

    steps.push({
      step: 'DUPLICATE_CHECK',
      passed: true,
      message: 'No duplicate document found',
    });

    // If validation failed, don't upload
    if (!overallValid) {
      await auditService.log({
        actorId: uploadedBy,
        actorRole: 'Borrower',
        action: AuditAction.DOCUMENT_VALIDATION_FAILED,
        entityType: EntityType.DOCUMENT,
        metadata: { steps, originalName: file.originalname },
        ipAddress,
        userAgent,
      });

      throw new AppError(
        'Document validation failed',
        422,
        'DOCUMENT_VALIDATION_FAILED',
        { validationResults: { steps, overall: false } }
      );
    }

    // Step 8: Upload to Supabase Storage
    const storageKey = `salary-slips/${uploadedBy}/${uuidv4()}${extension}`;
    await storageService.uploadFile(file.buffer, storageKey, file.mimetype);

    // Step 9: Persist document metadata
    const document = await DocumentModel.create({
      uploadedBy,
      storageKey,
      originalName: file.originalname,
      mimeType: detectedType?.mime || file.mimetype,
      size: file.size,
      sha256,
      validationStatus: DocumentValidationStatus.VALID,
      validationResults: { steps, overall: true },
    });

    // Audit successful upload
    await auditService.log({
      actorId: uploadedBy,
      actorRole: 'Borrower',
      action: AuditAction.DOCUMENT_VALIDATED,
      entityType: EntityType.DOCUMENT,
      entityId: document._id.toString(),
      newState: {
        originalName: file.originalname,
        mimeType: document.mimeType,
        size: file.size,
        sha256,
      },
      ipAddress,
      userAgent,
    });

    return document;
  }

  async getById(documentId: string, requesterId: string, requesterRole: string) {
    const document = await DocumentModel.findById(documentId);
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Resource-level auth: borrowers can only view their own documents
    if (
      requesterRole === 'Borrower' &&
      document.uploadedBy.toString() !== requesterId
    ) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Generate signed URL
    const signedUrl = await storageService.getSignedUrl(document.storageKey);

    return {
      ...document.toJSON(),
      signedUrl,
    };
  }

  async getByUploader(uploaderId: string) {
    return DocumentModel.find({ uploadedBy: uploaderId })
      .sort({ createdAt: -1 })
      .lean();
  }
}

export const documentService = new DocumentService();
