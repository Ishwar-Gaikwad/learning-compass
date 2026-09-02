import { vectorSearchService } from './vectorSearchService.js';
import { contextBuilder } from './contextBuilder.js';
import { Material } from '../../models/Material.js';
import { AppError } from '../../utils/AppError.js';

export const DEFAULT_TOP_K = 5;
export const DEFAULT_SIMILARITY_THRESHOLD = -1.0;

export const ragRetrievalService = {
  async retrieveRelevantChunks({
    query,
    teacherId,
    courseId,
    topicId,
    materialId,
    materialIds,
    topK = DEFAULT_TOP_K,
    minScore = DEFAULT_SIMILARITY_THRESHOLD
  }) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new AppError('Retrieval query string is required.', 400, 'MISSING_QUERY');
    }

    if (!teacherId) {
      throw new AppError('Teacher reference (teacherId) is required for tenant isolation.', 400, 'TENANT_FILTER_REQUIRED');
    }

    const requestedTopK = parseInt(topK, 10) || DEFAULT_TOP_K;

    // 1. Resolve allowed material IDs for strict scoping
    let allowedMaterialIds = [];
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      allowedMaterialIds = materialIds.map((id) => id.toString());
    } else if (materialId) {
      allowedMaterialIds = [materialId.toString()];
    } else if (topicId) {
      const topicMaterialFilter = { topicId, teacherId };
      if (courseId) {
        topicMaterialFilter.courseId = courseId;
      }
      const materials = await Material.find(topicMaterialFilter).select('_id').lean();
      allowedMaterialIds = materials.map((m) => m._id.toString());
    }

    if (allowedMaterialIds.length === 0 && (topicId || materialId || (materialIds && materialIds.length > 0))) {
      console.warn(`[RAG] No materials found for target scoping (topicId: ${topicId}, teacherId: ${teacherId}). Returning 0 chunks.`);
      return {
        query: query.trim(),
        chunks: [],
        chunksCount: 0,
        context: contextBuilder.buildContext([]),
        topK: requestedTopK,
        minScore
      };
    }

    // 2. Execute vector similarity search via vectorSearchService
    const candidateChunks = await vectorSearchService.searchSimilarChunks({
      queryText: query,
      teacherId,
      courseId,
      topicId,
      materialId,
      materialIds: allowedMaterialIds,
      limit: requestedTopK * 3 // Fetch candidate buffer for score threshold filtering
    });

    // 3. HARD VALIDATION: Verify every chunk belongs strictly to allowed materialIds / topicId / teacherId
    const validatedChunks = [];
    for (const chunk of candidateChunks) {
      const chunkMatId = chunk.materialId ? chunk.materialId.toString() : '';
      const chunkTeacherId = chunk.teacherId ? chunk.teacherId.toString() : '';
      const chunkTopicId = chunk.topicId ? chunk.topicId.toString() : '';

      if (chunkTeacherId && chunkTeacherId !== teacherId.toString()) {
        console.error(`[RAG SECURITY VIOLATION] Chunk ${chunk._id} belongs to teacher ${chunkTeacherId}, expected ${teacherId}. Rejecting chunk.`);
        continue;
      }

      if (topicId && chunkTopicId && chunkTopicId !== topicId.toString()) {
        console.error(`[RAG CROSS-TOPIC VIOLATION] Chunk ${chunk._id} belongs to topic ${chunkTopicId}, expected ${topicId}. Rejecting chunk.`);
        continue;
      }

      if (allowedMaterialIds.length > 0 && !allowedMaterialIds.includes(chunkMatId)) {
        console.error(`[RAG CROSS-MATERIAL VIOLATION] Chunk ${chunk._id} belongs to material ${chunkMatId}, not in allowed materialIds [${allowedMaterialIds.join(', ')}]. Rejecting chunk.`);
        continue;
      }

      validatedChunks.push(chunk);
    }

    // 4. Score threshold filtering
    const relevantChunks = validatedChunks
      .filter((chunk) => typeof chunk.score === 'number' && chunk.score >= minScore)
      .slice(0, requestedTopK);

    // 5. Build structured context block with source citations for downstream AI grounding
    const contextData = contextBuilder.buildContext(relevantChunks);

    // 6. Log RAG diagnostic summary (Step 6 requirement)
    const retrievedChunkIds = relevantChunks.map((c) => c._id.toString());
    const retrievedMaterialIds = Array.from(new Set(relevantChunks.map((c) => (c.materialId ? c.materialId.toString() : ''))));

    console.log(`[RAG] Assessment generation`);
    console.log(`Course ID: ${courseId || 'N/A'}`);
    console.log(`Topic ID: ${topicId || 'N/A'}`);
    console.log(`Topic: ${query}`);
    console.log(`Material IDs: ${JSON.stringify(allowedMaterialIds)}`);
    console.log(`Retrieved chunk IDs: ${JSON.stringify(retrievedChunkIds)}`);
    console.log(`Retrieved material IDs: ${JSON.stringify(retrievedMaterialIds)}`);
    console.log(`Retrieved chunk count: ${relevantChunks.length}`);

    return {
      query: query.trim(),
      chunks: relevantChunks,
      chunksCount: relevantChunks.length,
      context: contextData,
      topK: requestedTopK,
      minScore
    };
  }
};
