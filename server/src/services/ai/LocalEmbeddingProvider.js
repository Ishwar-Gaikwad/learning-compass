import crypto from 'crypto';
import { BaseEmbeddingProvider } from './BaseEmbeddingProvider.js';

export class LocalEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(options = {}) {
    super();
    this.dimensions = options.dimensions || parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);
    this.modelName = options.modelName || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.generationCallCount = 0;
  }

  getDimensions() {
    return this.dimensions;
  }

  getModelName() {
    return this.modelName;
  }

  resetCallCount() {
    this.generationCallCount = 0;
  }

  async generateEmbedding(text) {
    this.generationCallCount++;
    if (!text || typeof text !== 'string') {
      text = '';
    }

    const cleanText = text.trim().toLowerCase();
    const hash = crypto.createHash('sha256').update(cleanText).digest();
    
    const vector = new Array(this.dimensions);
    let normSq = 0;

    for (let i = 0; i < this.dimensions; i++) {
      // Deterministic pseudo-random float generation based on SHA-256 seed & dimension index
      const seedStr = `${cleanText}_dim_${i}`;
      const dimHash = crypto.createHash('md5').update(seedStr).digest();
      const val = (dimHash.readInt32BE(0) % 10000) / 10000.0;
      vector[i] = val;
      normSq += val * val;
    }

    // L2 Normalization so magnitude ||v|| = 1.0 for cosine similarity
    const norm = Math.sqrt(normSq) || 1.0;
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
