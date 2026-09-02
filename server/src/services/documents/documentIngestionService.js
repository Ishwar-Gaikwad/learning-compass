import { Material } from '../../models/Material.js';
import { textExtractor } from './textExtractor.js';
import { conditionalOCRService } from './conditionalOCRService.js';
import { chunkingService } from './chunkingService.js';
import { embeddingIngestionService } from './embeddingIngestionService.js';
import { storageService } from '../storage/storageService.js';
import { AppError } from '../../utils/AppError.js';

export const documentIngestionService = {
  async processMaterialDocument(materialId, teacherId, options = {}) {
    const material = await Material.findById(materialId);

    if (!material) {
      throw new AppError('Material record not found.', 404, 'MATERIAL_NOT_FOUND');
    }

    if (teacherId && material.teacherId.toString() !== teacherId.toString()) {
      throw new AppError('Access denied. You do not own this material.', 403, 'FORBIDDEN');
    }

    // Step 1: Transition status -> 'processing'
    material.status = 'processing';
    material.processingError = undefined;
    await material.save();

    try {
      // Step 2: Retrieve file buffer via storage abstraction
      if (!material.storageKey) {
        throw new Error('Storage key is missing for material file.');
      }
      const fileBuffer = await storageService.getFileBuffer(material.storageKey);

      // Step 3: Native text extraction
      let extractionResult = { text: '', characterCount: 0, wordCount: 0, hasUsableText: false };

      if (material.fileType === 'pdf' || material.mimeType === 'application/pdf') {
        extractionResult = textExtractor.extractTextFromPdfBuffer(fileBuffer);
      }

      // Step 4: Conditional OCR evaluation
      const finalExtractionResult = await conditionalOCRService.evaluateAndRunOcr({
        pdfBuffer: fileBuffer,
        storageKey: material.storageKey,
        textExtractionResult: extractionResult,
        options
      });

      material.extractedText = finalExtractionResult.text;
      material.extractedTextMetadata = {
        characterCount: finalExtractionResult.characterCount,
        wordCount: finalExtractionResult.wordCount,
        ocrExecuted: finalExtractionResult.ocrExecuted,
        hasUsableText: finalExtractionResult.hasUsableText,
        totalChunksCount: 0
      };

      // Step 5: Transition status -> 'chunking'
      material.status = 'chunking';
      await material.save();

      // Step 6: Create DocumentChunk records in MongoDB Atlas
      const savedChunks = await chunkingService.chunkAndSaveMaterial(material._id, options);

      // Step 7: Transition status -> 'embedding'
      material.status = 'embedding';
      await material.save();

      // Step 8: Generate vector embeddings for DocumentChunks
      const embeddingResult = await embeddingIngestionService.generateEmbeddingsForMaterial(material._id, options);

      // Step 9: Transition status -> 'processed'
      material.extractedTextMetadata.totalChunksCount = savedChunks.length;
      material.status = 'processed';
      await material.save();

      return {
        material,
        chunksCount: savedChunks.length,
        embeddingResult,
        chunks: savedChunks
      };

    } catch (err) {
      material.status = 'failed';
      material.processingError = {
        message: err.message || 'Material document processing failed during ingestion pipeline execution.',
        code: err.errorCode || 'DOCUMENT_PROCESSING_FAILED',
        failedAt: new Date()
      };
      await material.save();

      throw new AppError(
        `Material document processing failed: ${err.message}`,
        400,
        err.errorCode || 'DOCUMENT_PROCESSING_FAILED',
        { materialId: material._id, status: material.status }
      );
    }
  }
};
