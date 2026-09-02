import mongoose from 'mongoose';
import { DocumentChunk } from '../../models/DocumentChunk.js';
import { embeddingService } from '../ai/embeddingService.js';
import { AppError } from '../../utils/AppError.js';

export const vectorSearchService = {
  calculateCosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      return 0;
    }
    let dotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
    }
    return dotProduct;
  },

  async searchSimilarChunks({ queryText, teacherId, courseId, topicId, materialId, materialIds, limit = 5 }) {
    if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
      throw new AppError('Search query string is required for vector search.', 400, 'MISSING_QUERY');
    }

    if (!teacherId) {
      throw new AppError('Teacher reference (teacherId) is required to enforce tenant boundaries.', 400, 'TENANT_FILTER_REQUIRED');
    }

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId.toString());
    const queryVector = await embeddingService.generateEmbedding(queryText);

    // 1. Primary MongoDB Atlas Vector Search Pipeline Stage
    const filter = {
      teacherId: teacherObjectId
    };

    if (courseId) {
      filter.courseId = new mongoose.Types.ObjectId(courseId.toString());
    }
    if (topicId) {
      filter.topicId = new mongoose.Types.ObjectId(topicId.toString());
    }

    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      const materialObjectIds = materialIds.map((id) => new mongoose.Types.ObjectId(id.toString()));
      filter.materialId = materialObjectIds.length === 1 ? materialObjectIds[0] : { $in: materialObjectIds };
    } else if (materialId) {
      filter.materialId = new mongoose.Types.ObjectId(materialId.toString());
    }

    const indexName = process.env.VECTOR_INDEX_NAME || 'document_chunks_vector_index';
    const vectorPath = process.env.VECTOR_SEARCH_PATH || 'embedding';
    const numCandidates = parseInt(process.env.VECTOR_SEARCH_NUM_CANDIDATES || '50', 10);

    const vectorSearchStage = {
      $vectorSearch: {
        index: indexName,
        path: vectorPath,
        queryVector: queryVector,
        numCandidates: Math.max(limit * 10, numCandidates),
        limit: limit,
        filter
      }
    };

    const projectionStage = {
      $project: {
        _id: 1,
        materialId: 1,
        courseId: 1,
        topicId: 1,
        teacherId: 1,
        content: 1,
        pageNumber: 1,
        chunkIndex: 1,
        tokenCount: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    };

    try {
      const results = await DocumentChunk.aggregate([vectorSearchStage, projectionStage]);
      if (results && results.length > 0) {
        return results;
      }
    } catch (atlasErr) {
      // Proceed to fallback
    }

    // 2. Standalone / Local Cosine Similarity Search Fallback
    const candidateChunks = await DocumentChunk.find(filter);

    const scoredChunks = candidateChunks
      .map((chunk) => {
        const score = this.calculateCosineSimilarity(queryVector, chunk.embedding);
        return {
          _id: chunk._id,
          materialId: chunk.materialId,
          courseId: chunk.courseId,
          topicId: chunk.topicId,
          teacherId: chunk.teacherId,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata,
          score
        };
      })
      .filter((chunk) => chunk.score > -1.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredChunks;
  }
};
