import crypto from 'crypto';
import { LocalEmbeddingProvider } from './LocalEmbeddingProvider.js';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider.js';

class EmbeddingService {
  constructor() {
    const providerType = process.env.EMBEDDING_PROVIDER || 'local';
    if (providerType === 'openai' && process.env.OPENAI_API_KEY) {
      this.provider = new OpenAIEmbeddingProvider();
    } else {
      this.provider = new LocalEmbeddingProvider();
    }
  }

  setProvider(providerInstance) {
    this.provider = providerInstance;
  }

  getProvider() {
    return this.provider;
  }

  getDimensions() {
    return this.provider.getDimensions();
  }

  getModelName() {
    return this.provider.getModelName();
  }

  computeContentHash(text) {
    if (!text || typeof text !== 'string') return '';
    return crypto.createHash('sha256').update(text.trim()).digest('hex');
  }

  async generateEmbedding(text) {
    return await this.provider.generateEmbedding(text);
  }

  async generateEmbeddingsBatch(textArray) {
    return await this.provider.generateEmbeddingsBatch(textArray);
  }
}

export const embeddingService = new EmbeddingService();
