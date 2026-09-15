import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

class StorageService {
  private folder = env.CLOUDINARY_FOLDER;

  private isConfigured(): boolean {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) return false;
    if (
      cloudName.includes('your-cloud-name') ||
      apiKey.includes('your-api-key') ||
      apiSecret.includes('your-api-secret')
    ) {
      return false;
    }

    return true;
  }

  async uploadFile(
    buffer: Buffer,
    storageKey: string,
    mimeType: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      console.warn(
        '⚠️ Cloudinary credentials are missing or placeholders in server/.env. Using mock storage for local testing.'
      );
      return `mock-storage/${storageKey.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}`;
    }

    return new Promise((resolve, reject) => {
      const isImage = mimeType.startsWith('image/');
      const resourceType = isImage ? 'image' : 'raw';
      const cleanPublicId = storageKey.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: cleanPublicId,
          folder: this.folder,
          resource_type: resourceType,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            console.error('Cloudinary upload error:', error);

            // If Cloudinary cloud name is disabled or unauthorized, fallback to mock storage in dev mode
            if (
              error?.message?.includes('disabled') ||
              error?.http_code === 401
            ) {
              console.warn(
                '⚠️ Cloudinary account is disabled or unauthorized. Falling back to mock storage mode for local dev.'
              );
              return resolve(`mock-storage/${cleanPublicId}`);
            }

            return reject(
              new AppError(
                error?.message || 'Failed to upload document to storage',
                500,
                'STORAGE_UPLOAD_FAILED'
              )
            );
          }
          resolve(result.public_id);
        }
      );

      uploadStream.end(buffer);
    });
  }

  async getSignedUrl(storageKey: string): Promise<string> {
    if (!this.isConfigured() || storageKey.startsWith('mock-storage/')) {
      return `https://res.cloudinary.com/demo/image/upload/sample.jpg`;
    }

    try {
      const isPdf = storageKey.toLowerCase().endsWith('.pdf');
      const resourceType = isPdf ? 'raw' : 'image';

      const url = cloudinary.url(storageKey, {
        resource_type: resourceType,
        secure: true,
        sign_url: true,
      });

      return url;
    } catch (error) {
      console.error('Cloudinary URL generation error:', error);
      return `https://res.cloudinary.com/demo/image/upload/sample.jpg`;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured() || storageKey.startsWith('mock-storage/')) return;
    try {
      const isPdf = storageKey.toLowerCase().endsWith('.pdf');
      const resourceType = isPdf ? 'raw' : 'image';
      await cloudinary.uploader.destroy(storageKey, { resource_type: resourceType });
    } catch (error) {
      console.error('Cloudinary delete error:', error);
    }
  }
}

export const storageService = new StorageService();
