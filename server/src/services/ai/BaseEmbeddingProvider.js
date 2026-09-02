export class BaseEmbeddingProvider {
  async generateEmbedding(text) {
    throw new Error('Method generateEmbedding() must be implemented by EmbeddingProvider subclass.');
  }

  async generateEmbeddingsBatch(textArray) {
    return Promise.all(textArray.map((text) => this.generateEmbedding(text)));
  }

  getDimensions() {
    throw new Error('Method getDimensions() must be implemented by EmbeddingProvider subclass.');
  }

  getModelName() {
    throw new Error('Method getModelName() must be implemented by EmbeddingProvider subclass.');
  }
}
