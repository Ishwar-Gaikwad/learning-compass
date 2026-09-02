export const contextBuilder = {
  buildContext(chunks, options = {}) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return {
        formattedContext: 'No relevant learning material context found.',
        sourceMaterials: [],
        totalChunks: 0,
        totalTokens: 0
      };
    }

    let totalTokens = 0;
    const sourceMaterialsMap = new Map();

    const contextBlocks = chunks.map((chunk, index) => {
      const tokens = chunk.tokenCount || Math.ceil((chunk.content || '').length / 4);
      totalTokens += tokens;

      const fileName = chunk.metadata?.originalFileName || 'Material Document';
      const pageCitation = chunk.pageNumber ? `Page ${chunk.pageNumber}` : 'Page N/A';
      const scoreCitation = typeof chunk.score === 'number' ? ` | Similarity: ${(chunk.score * 100).toFixed(1)}%` : '';
      
      const citationHeader = `[Source #${index + 1} | File: ${fileName} | ${pageCitation} | Chunk #${chunk.chunkIndex}${scoreCitation}]`;

      if (chunk.materialId) {
        sourceMaterialsMap.set(chunk.materialId.toString(), {
          materialId: chunk.materialId,
          fileName,
          topicId: chunk.topicId,
          courseId: chunk.courseId,
          pageNumber: chunk.pageNumber
        });
      }

      return `${citationHeader}\n${chunk.content.trim()}`;
    });

    const formattedContext = contextBlocks.join('\n\n---\n\n');

    return {
      formattedContext,
      sourceMaterials: Array.from(sourceMaterialsMap.values()),
      totalChunks: chunks.length,
      totalTokens
    };
  }
};
