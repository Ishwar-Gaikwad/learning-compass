export class BaseStorageProvider {
  async saveFile({ buffer, originalName, mimeType, teacherId }) {
    throw new Error('Method saveFile() must be implemented by StorageProvider subclass.');
  }

  async deleteFile(storageKey) {
    throw new Error('Method deleteFile() must be implemented by StorageProvider subclass.');
  }

  async getFileUrl(storageKey) {
    throw new Error('Method getFileUrl() must be implemented by StorageProvider subclass.');
  }

  async getFileBuffer(storageKey) {
    throw new Error('Method getFileBuffer() must be implemented by StorageProvider subclass.');
  }
}
