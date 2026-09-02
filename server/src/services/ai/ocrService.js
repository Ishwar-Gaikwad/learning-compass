import { GeminiOCRProvider } from './GeminiOCRProvider.js';
import { LocalOCRProvider } from './LocalOCRProvider.js';

class OCRService {
  constructor() {
    this.provider = null;
  }

  setProvider(providerInstance) {
    this.provider = providerInstance;
  }

  getProvider() {
    if (this.provider) return this.provider;

    const providerType = process.env.OCR_PROVIDER;
    if (providerType === 'local') {
      return new LocalOCRProvider();
    }

    // Default production provider is GeminiOCRProvider
    return new GeminiOCRProvider();
  }

  async processPdfOcr({ pdfBuffer, storageKey, options = {} }) {
    return await this.getProvider().processPdfOcr({ pdfBuffer, storageKey, options });
  }

  async processImageOcr({ imageBuffer, mimeType, options = {} }) {
    return await this.getProvider().processImageOcr({ imageBuffer, mimeType, options });
  }
}

export const ocrService = new OCRService();
