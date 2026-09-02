import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseStorageProvider } from './BaseStorageProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE_DIR = path.join(__dirname, '../../../uploads');

export class LocalStorageProvider extends BaseStorageProvider {
  constructor() {
    super();
    if (!fs.existsSync(UPLOADS_BASE_DIR)) {
      fs.mkdirSync(UPLOADS_BASE_DIR, { recursive: true });
    }
  }

  async saveFile({ buffer, originalName, mimeType, teacherId }) {
    const teacherDir = path.join(UPLOADS_BASE_DIR, 'materials', teacherId.toString());
    if (!fs.existsSync(teacherDir)) {
      fs.mkdirSync(teacherDir, { recursive: true });
    }

    const ext = path.extname(originalName) || '';
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${baseName}${ext}`;
    const filePath = path.join(teacherDir, uniqueFileName);

    await fs.promises.writeFile(filePath, buffer);

    const storageKey = `materials/${teacherId.toString()}/${uniqueFileName}`;
    const fileUrl = `/uploads/materials/${teacherId.toString()}/${uniqueFileName}`;

    return {
      storageKey,
      fileUrl,
      filePath
    };
  }

  async getFileBuffer(storageKey) {
    const safePath = path.resolve(UPLOADS_BASE_DIR, storageKey);
    if (!safePath.startsWith(path.resolve(UPLOADS_BASE_DIR))) {
      throw new Error('Access denied. Path traversal attempt detected.');
    }
    if (!fs.existsSync(safePath)) {
      throw new Error('Requested file could not be found in storage.');
    }
    return await fs.promises.readFile(safePath);
  }

  async deleteFile(storageKey) {
    const safePath = path.resolve(UPLOADS_BASE_DIR, storageKey);
    if (!safePath.startsWith(path.resolve(UPLOADS_BASE_DIR))) {
      throw new Error('Access denied. Path traversal attempt detected.');
    }
    if (fs.existsSync(safePath)) {
      await fs.promises.unlink(safePath);
    }
    return true;
  }

  async getFileUrl(storageKey) {
    return `/uploads/${storageKey}`;
  }
}
