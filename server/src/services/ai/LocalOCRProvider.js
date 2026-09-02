import { BaseOCRProvider } from './BaseOCRProvider.js';
import { AppError } from '../../utils/AppError.js';

export class LocalOCRProvider extends BaseOCRProvider {
  constructor(options = {}) {
    super();
    this.simulatedFailure = options.simulatedFailure || false;
    this.mockText = options.mockText || null;
  }

  setSimulatedFailure(shouldFail) {
    this.simulatedFailure = shouldFail;
  }

  setMockText(text) {
    this.mockText = text;
  }

  async processPdfOcr({ pdfBuffer, storageKey, options = {} }) {
    if (this.simulatedFailure || options.forceFail) {
      throw new AppError('OCR provider engine processing error: Unable to render image stream.', 400, 'OCR_PROCESSING_FAILED');
    }

    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw new AppError('Invalid PDF buffer supplied for OCR processing.', 400, 'INVALID_PDF_BUFFER');
    }

    // Return mock text if explicitly supplied in options or via setMockText
    const textToUse = options.mockOcrText || options.mockText || this.mockText;

    if (textToUse && typeof textToUse === 'string' && textToUse.trim().length > 0) {
      return {
        text: textToUse.trim(),
        pageCount: 1,
        provider: 'LocalOCRProvider',
        isSuccess: true
      };
    }

    // Explicit safe failure when no OCR provider engine is configured locally
    throw new AppError('This scanned document cannot be processed because OCR is not configured.', 400, 'OCR_NOT_AVAILABLE');
  }

  async processImageOcr({ imageBuffer, mimeType, options = {} }) {
    if (this.simulatedFailure || options.forceFail) {
      throw new AppError('OCR engine image processing failure.', 400, 'OCR_PROCESSING_FAILED');
    }

    const textToUse = options.mockOcrText || options.mockText || this.mockText;
    if (textToUse && typeof textToUse === 'string' && textToUse.trim().length > 0) {
      return {
        text: textToUse.trim(),
        provider: 'LocalOCRProvider',
        isSuccess: true
      };
    }

    throw new AppError('This image document cannot be processed because OCR is not configured.', 400, 'OCR_NOT_AVAILABLE');
  }
}
