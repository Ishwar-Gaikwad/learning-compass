import { DocumentChunk } from '../../models/DocumentChunk.js';
import { Material } from '../../models/Material.js';
import { AppError } from '../../utils/AppError.js';

export const DEFAULT_CHUNK_SIZE = 500;
export const DEFAULT_CHUNK_OVERLAP = 100;

export const chunkingService = {
  createChunksFromText(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const chunkOverlap = options.chunkOverlap || DEFAULT_CHUNK_OVERLAP;

    if (chunkOverlap >= chunkSize) {
      throw new Error('Chunk overlap must be smaller than chunk size.');
    }

    const step = chunkSize - chunkOverlap;

    // Parse page markers e.g. [Page 1], [Page 2]
    const pageMarkerRegex = /\[Page\s+(\d+)\]/gi;
    const pageSpans = [];
    let pageMatch;

    while ((pageMatch = pageMarkerRegex.exec(text)) !== null) {
      pageSpans.push({
        page: parseInt(pageMatch[1], 10),
        index: pageMatch.index
      });
    }

    function getPageForIndex(index) {
      if (pageSpans.length === 0) return 1;
      let page = pageSpans[0].page;
      for (const span of pageSpans) {
        if (index >= span.index) {
          page = span.page;
        } else {
          break;
        }
      }
      return page;
    }

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      if (end < text.length) {
        const spaceIdx = text.lastIndexOf(' ', end);
        if (spaceIdx > start + Math.floor(chunkSize * 0.5)) {
          end = spaceIdx;
        }
      } else {
        end = text.length;
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        const pageNumber = getPageForIndex(start);
        const tokenCount = Math.ceil(chunkText.length / 4);

        chunks.push({
          chunkIndex,
          content: chunkText,
          pageNumber,
          tokenCount
        });
        chunkIndex++;
      }

      if (end >= text.length) break;
      start = start + step;
    }

    return chunks;
  },

  async chunkAndSaveMaterial(materialId, options = {}) {
    const material = await Material.findById(materialId);

    if (!material) {
      throw new AppError('Material document not found for chunking.', 404, 'MATERIAL_NOT_FOUND');
    }

    if (!material.extractedText || material.extractedText.trim().length === 0) {
      await DocumentChunk.deleteMany({ materialId: material._id });
      material.extractedTextMetadata.totalChunksCount = 0;
      await material.save();
      return [];
    }

    // Delete previous chunks to handle reprocessing cleanly without duplicate records
    await DocumentChunk.deleteMany({ materialId: material._id });

    const rawChunks = this.createChunksFromText(material.extractedText, options);

    const chunkDocuments = rawChunks.map((chunk) => ({
      materialId: material._id,
      courseId: material.courseId,
      topicId: material.topicId,
      teacherId: material.teacherId,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      embedding: [],
      metadata: {
        originalFileName: material.originalFileName,
        mimeType: material.mimeType,
        fileType: material.fileType
      }
    }));

    let savedChunks = [];
    if (chunkDocuments.length > 0) {
      savedChunks = await DocumentChunk.insertMany(chunkDocuments);
    }

    material.extractedTextMetadata.totalChunksCount = savedChunks.length;
    await material.save();

    return savedChunks;
  }
};
