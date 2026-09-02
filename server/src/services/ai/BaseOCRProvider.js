export class BaseOCRProvider {
  async processPdfOcr({ pdfBuffer, storageKey, options }) {
    throw new Error('Method processPdfOcr() must be implemented by OCRProvider subclass.');
  }

  async processImageOcr({ imageBuffer, mimeType, options }) {
    throw new Error('Method processImageOcr() must be implemented by OCRProvider subclass.');
  }
}
