import { LocalStorageProvider } from './LocalStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';

class StorageService {
  constructor() {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    if (providerType === 's3') {
      this.provider = new S3StorageProvider();
    } else {
      this.provider = new LocalStorageProvider();
    }
  }

  setProvider(providerInstance) {
    this.provider = providerInstance;
  }

  async saveFile({ buffer, originalName, mimeType, teacherId }) {
    return await this.provider.saveFile({ buffer, originalName, mimeType, teacherId });
  }

  async getFileBuffer(storageKey) {
    return await this.provider.getFileBuffer(storageKey);
  }

  async deleteFile(storageKey) {
    return await this.provider.deleteFile(storageKey);
  }

  async getFileUrl(storageKey) {
    return await this.provider.getFileUrl(storageKey);
  }
}

export const storageService = new StorageService();
