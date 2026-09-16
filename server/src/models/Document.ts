import mongoose, { Schema, Document } from 'mongoose';
import { IDocument, DocumentValidationStatus } from '../types';

export interface IDocumentModel extends Omit<IDocument, '_id'>, Document { }

const documentSchema = new Schema<IDocumentModel>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'LoanApplication',
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    sha256: {
      type: String,
      required: true,
      unique: true,
    },
    validationStatus: {
      type: String,
      enum: Object.values(DocumentValidationStatus),
      default: DocumentValidationStatus.PENDING,
    },
    validationResults: {
      type: Schema.Types.Mixed,
      default: { steps: [], overall: false },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const DocumentModel = mongoose.model<IDocumentModel>('Document', documentSchema);
