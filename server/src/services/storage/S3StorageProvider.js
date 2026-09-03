import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { BaseStorageProvider } from './BaseStorageProvider.js';

export class S3StorageProvider extends BaseStorageProvider {
  constructor(customConfig = {}) {
    super();
    this.bucketName = customConfig.bucketName || process.env.AWS_S3_BUCKET_NAME || 'learning-compass-materials';
    this.endpoint = customConfig.endpoint || process.env.S3_ENDPOINT;
    this.region = customConfig.region || process.env.S3_REGION || 'us-east-1';

    const accessKeyId = customConfig.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = customConfig.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    const clientConfig = {
      region: this.region,
      forcePathStyle: true
    };

    if (this.endpoint) {
      clientConfig.endpoint = this.endpoint;
    }

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey
      };
    }

    this.client = customConfig.client || new S3Client(clientConfig);
  }

  async saveFile({ buffer, originalName, mimeType, teacherId }) {
    if (!buffer) {
      throw new Error('File buffer is required for upload.');
    }

    const ext = path.extname(originalName) || '';
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${baseName}${ext}`;
    const storageKey = `materials/${teacherId.toString()}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream'
    });

    await this.client.send(command);

    const fileUrl = await this.getFileUrl(storageKey);

    return {
      storageKey,
      fileUrl
    };
  }

  async getFileBuffer(storageKey) {
    if (!storageKey) {
      throw new Error('Storage key is required to retrieve file buffer.');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error(`Empty response body received for key: ${storageKey}`);
      }

      if (typeof response.Body.transformToByteArray === 'function') {
        const byteArray = await response.Body.transformToByteArray();
        return Buffer.from(byteArray);
      } else if (typeof response.Body.transformToString === 'function') {
        const str = await response.Body.transformToString();
        return Buffer.from(str);
      } else if (Buffer.isBuffer(response.Body)) {
        return response.Body;
      } else {
        const chunks = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`Requested file could not be found in storage: ${storageKey}`);
      }
      throw err;
    }
  }

  async deleteFile(storageKey) {
    if (!storageKey) {
      throw new Error('Storage key is required to delete file.');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey
    });

    await this.client.send(command);
    return true;
  }

  async getFileUrl(storageKey) {
    if (this.endpoint) {
      const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
      return `${cleanEndpoint}/${this.bucketName}/${storageKey}`;
    }
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${storageKey}`;
  }
}

