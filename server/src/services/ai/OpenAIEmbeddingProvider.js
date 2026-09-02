import { BaseEmbeddingProvider } from './BaseEmbeddingProvider.js';

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.modelName = options.modelName || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = options.dimensions || parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);
  }

  getDimensions() {
    return this.dimensions;
  }

  getModelName() {
    return this.modelName;
  }

  async generateEmbedding(text) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables.');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        input: text,
        dimensions: this.dimensions
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Embedding API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
