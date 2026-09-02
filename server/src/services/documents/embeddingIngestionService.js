import { DocumentChunk } from '../../models/DocumentChunk.js';
import { Material } from '../../models/Material.js';
import { embeddingService } from '../ai/embeddingService.js';
import { AppError } from '../../utils/AppError.js';

export const embeddingIngestionService = {
  async generateEmbeddingsForMaterial(materialId, options = {}) {
    const material = await Material.findById(materialId);

    if (!material) {
      throw new AppError('Material record not found for embedding generation.', 404, 'MATERIAL_NOT_FOUND');
    }

    const chunks = await DocumentChunk.find({ materialId }).sort({ chunkIndex: 1 });

    if (!chunks || chunks.length === 0) {
      return { materialId, processedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    const targetDimensions = embeddingService.getDimensions();
    const modelName = embeddingService.getModelName();

    let updatedCount = 0;
    let skippedCount = 0;

    for (const chunk of chunks) {
      const currentContentHash = embeddingService.computeContentHash(chunk.content);
      const existingHash = chunk.metadata?.contentHash;
      const hasValidEmbedding = Array.isArray(chunk.embedding) && chunk.embedding.length === targetDimensions;

      // Idempotency check: Skip regeneration if content and dimension have not changed
      if (hasValidEmbedding && existingHash === currentContentHash && !options.forceRegenerate) {
        skippedCount++;
        continue;
      }

      // Generate embedding vector (1536 floats)
      const embeddingVector = await embeddingService.generateEmbedding(chunk.content);

      if (!Array.isArray(embeddingVector) || embeddingVector.length !== targetDimensions) {
        throw new Error(`Embedding provider returned invalid vector dimensions (${embeddingVector?.length} vs expected ${targetDimensions}).`);
      }

      chunk.embedding = embeddingVector;
      chunk.metadata = {
        ...(chunk.metadata || {}),
        contentHash: currentContentHash,
        embeddingModel: modelName,
        dimensions: targetDimensions,
        lastEmbeddedAt: new Date()
      };

      await chunk.save();
      updatedCount++;
    }

    return {
      materialId,
      processedCount: chunks.length,
      updatedCount,
      skippedCount,
      dimensions: targetDimensions,
      modelName
    };
  }
};
