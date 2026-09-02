import { BaseStorageProvider } from './BaseStorageProvider.js';

export class S3StorageProvider extends BaseStorageProvider {
  async saveFile({ buffer, originalName, mimeType, teacherId }) {
    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const storageKey = `materials/${teacherId.toString()}/${uniqueFileName}`;
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'learning-compass-materials';
    const fileUrl = `https://${bucketName}.s3.amazonaws.com/${storageKey}`;

    return {
      storageKey,
      fileUrl
    };
  }

  async getFileBuffer(storageKey) {
    throw new Error('S3 getFileBuffer not implemented in mock provider.');
  }

  async deleteFile(storageKey) {
    return true;
  }

  async getFileUrl(storageKey) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'learning-compass-materials';
    return `https://${bucketName}.s3.amazonaws.com/${storageKey}`;
  }
}
