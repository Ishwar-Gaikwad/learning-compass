import { ocrService } from '../ai/ocrService.js';
import { AppError } from '../../utils/AppError.js';

export const conditionalOCRService = {
  async evaluateAndRunOcr({ pdfBuffer, storageKey, textExtractionResult, options = {} }) {
    // Rule 1: If normal text extraction produced usable text, DO NOT invoke OCR.
    if (textExtractionResult && textExtractionResult.hasUsableText) {
      return {
        ocrExecuted: false,
        text: textExtractionResult.text,
        characterCount: textExtractionResult.characterCount,
        wordCount: textExtractionResult.wordCount,
        hasUsableText: true
      };
    }

    // Rule 2: Normal extraction produced insufficient usable text (e.g. scanned PDF). Invoke OCR Fallback.
    try {
      const ocrResult = await ocrService.processPdfOcr({
        pdfBuffer,
        storageKey,
        options
      });

      if (!ocrResult || !ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new AppError('OCR fallback processing produced no text output from scanned document.', 400, 'OCR_EMPTY_OUTPUT');
      }

      const cleanText = ocrResult.text.trim();
      const characterCount = cleanText.length;
      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

      return {
        ocrExecuted: true,
        text: cleanText,
        characterCount,
        wordCount,
        hasUsableText: characterCount > 0,
        provider: ocrResult.provider || 'OCRService'
      };

    } catch (err) {
      if (err instanceof AppError || err.errorCode || err.code) {
        throw err;
      }
      // Re-throw sanitized error for documentIngestionService to transition state to 'failed'
      throw new AppError(
        'OCR fallback processing failed on scanned material.',
        400,
        'OCR_PROCESSING_FAILED',
        { originalMessage: err.message }
      );
    }
  }
};
