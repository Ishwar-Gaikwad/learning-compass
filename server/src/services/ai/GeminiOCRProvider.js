import { GoogleGenAI } from '@google/genai';
import { BaseOCRProvider } from './BaseOCRProvider.js';
import { aiObservabilityService } from './aiObservabilityService.js';
import { AppError } from '../../utils/AppError.js';

export const GEMINI_OCR_SYSTEM_PROMPT = `You are a high-precision Optical Character Recognition (OCR) engine.
Your task is to perform exact textual optical character recognition on the provided document or image.

STRICT INSTRUCTIONS & CONSTRAINTS:
1. Extract all visible text exactly as it appears in the document or image.
2. Do NOT summarize, shorten, paraphrase, or rephrase the content in any way.
3. Do NOT invent missing text, guess missing words, or assume facts not visible in the document.
4. Do NOT add any introductory remarks, explanations, commentary, or markdown wrapping (do NOT output "Here is the extracted text:").
5. Do NOT generate questions, answers, rubrics, or assessments.
6. Do NOT mention OCR, RAG, chunks, citations, or file processing metadata in the extracted content.
7. Preserve mathematical notation, equations, variables, formulas, and technical terminology as accurately as possible.
8. Output ONLY the raw extracted text from the document.
If the document contains no legible text, return an empty string.`;

export function validateOcrOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { isValid: false, reason: 'Empty or invalid OCR text output.' };
  }

  const lower = rawText.toLowerCase();

  const forbiddenPhrases = [
    'optical character recognition (ocr) extracted text',
    'from scanned document',
    'quadratic equations are second-degree polynomial equations of the form ax^2 + bx + c = 0',
    'quadratic formula x = (-b +/- sqrt(b^2 - 4ac))',
    'synthetic division is a shorthand method'
  ];

  for (const phrase of forbiddenPhrases) {
    if (lower.includes(phrase)) {
      return { isValid: false, reason: `OCR output contains forbidden mock/fallback phrase: "${phrase}"` };
    }
  }

  return { isValid: true };
}

export class GeminiOCRProvider extends BaseOCRProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.modelName = options.modelName || process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    this.timeoutMs = options.timeoutMs || 30000;

    if (this.apiKey && this.apiKey.trim().length > 0) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey.trim() });
    }
  }

  getModelName() {
    return this.modelName;
  }

  getCandidateModels() {
    return Array.from(
      new Set(
        [
          this.modelName,
          process.env.GEMINI_OCR_MODEL,
          process.env.GEMINI_MODEL,
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.6-flash'
        ].filter(Boolean)
      )
    );
  }

  async withTimeout(promiseFn, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await promiseFn(controller.signal);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  cleanExtractedText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '');
    }
    return cleaned.trim();
  }

  async processPdfOcr({ pdfBuffer, storageKey, options = {} }) {
    if (!this.apiKey || this.apiKey.trim().length === 0 || !this.ai) {
      throw new AppError('This scanned document cannot be processed because OCR is not configured.', 400, 'OCR_NOT_AVAILABLE');
    }

    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw new AppError('Invalid PDF buffer supplied for Gemini OCR processing.', 400, 'INVALID_PDF_BUFFER');
    }

    const startTime = Date.now();
    const requestId = options.requestId || aiObservabilityService.generateRequestId();
    const candidates = this.getCandidateModels();

    let lastError = null;

    for (let idx = 0; idx < candidates.length; idx++) {
      const modelCandidate = candidates[idx];

      try {
        const response = await this.withTimeout(
          (signal) =>
            this.ai.models.generateContent({
              model: modelCandidate,
              contents: [
                {
                  inlineData: {
                    data: pdfBuffer.toString('base64'),
                    mimeType: 'application/pdf'
                  }
                },
                GEMINI_OCR_SYSTEM_PROMPT
              ],
              config: { temperature: 0.1 }
            }),
          this.timeoutMs
        );

        const rawResultText = response.text || '';
        const cleanedText = this.cleanExtractedText(rawResultText);

        const validation = validateOcrOutput(cleanedText);
        if (!validation.isValid) {
          throw new AppError(validation.reason, 400, 'OCR_VALIDATION_FAILED');
        }

        const latencyMs = Date.now() - startTime;
        aiObservabilityService.recordCall({
          requestId,
          operation: 'gemini_ocr_pdf',
          modelName: modelCandidate,
          latencyMs,
          status: 'success',
          retrievedChunkCount: 0,
          validationResult: 'VALID',
          retryCount: idx,
          fallbackUsed: idx > 0,
          tokenUsage: response.usageMetadata || {}
        });

        return {
          text: cleanedText,
          pageCount: options.pageCount || 1,
          provider: 'GeminiOCRProvider',
          modelName: modelCandidate,
          isSuccess: true
        };

      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        if (err.errorCode === 'OCR_VALIDATION_FAILED' || err.code === 'OCR_VALIDATION_FAILED') {
          throw err;
        }
        if (idx < candidates.length - 1) {
          console.warn(`[GeminiOCRProvider] Model ${modelCandidate} failed (${errMsg}). Trying next candidate model...`);
          continue;
        }
      }
    }

    throw new AppError(
      `Gemini OCR processing failed: ${lastError?.message || 'Unable to extract text from scanned document.'}`,
      400,
      'OCR_PROCESSING_FAILED'
    );
  }

  async processImageOcr({ imageBuffer, mimeType = 'image/png', options = {} }) {
    if (!this.apiKey || this.apiKey.trim().length === 0 || !this.ai) {
      throw new AppError('This image document cannot be processed because OCR is not configured.', 400, 'OCR_NOT_AVAILABLE');
    }

    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new AppError('Invalid image buffer supplied for Gemini OCR processing.', 400, 'INVALID_IMAGE_BUFFER');
    }

    const startTime = Date.now();
    const requestId = options.requestId || aiObservabilityService.generateRequestId();
    const candidates = this.getCandidateModels();

    let lastError = null;

    for (let idx = 0; idx < candidates.length; idx++) {
      const modelCandidate = candidates[idx];

      try {
        const response = await this.withTimeout(
          (signal) =>
            this.ai.models.generateContent({
              model: modelCandidate,
              contents: [
                {
                  inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType || 'image/png'
                  }
                },
                GEMINI_OCR_SYSTEM_PROMPT
              ],
              config: { temperature: 0.1 }
            }),
          this.timeoutMs
        );

        const rawResultText = response.text || '';
        const cleanedText = this.cleanExtractedText(rawResultText);

        const validation = validateOcrOutput(cleanedText);
        if (!validation.isValid) {
          throw new AppError(validation.reason, 400, 'OCR_VALIDATION_FAILED');
        }

        const latencyMs = Date.now() - startTime;
        aiObservabilityService.recordCall({
          requestId,
          operation: 'gemini_ocr_image',
          modelName: modelCandidate,
          latencyMs,
          status: 'success',
          retrievedChunkCount: 0,
          validationResult: 'VALID',
          retryCount: idx,
          fallbackUsed: idx > 0,
          tokenUsage: response.usageMetadata || {}
        });

        return {
          text: cleanedText,
          pageCount: 1,
          provider: 'GeminiOCRProvider',
          modelName: modelCandidate,
          isSuccess: true
        };

      } catch (err) {
        lastError = err;
        if (err.errorCode === 'OCR_VALIDATION_FAILED' || err.code === 'OCR_VALIDATION_FAILED') {
          throw err;
        }
        if (idx < candidates.length - 1) {
          console.warn(`[GeminiOCRProvider] Model ${modelCandidate} failed (${err.message}). Trying next candidate...`);
          continue;
        }
      }
    }

    throw new AppError(
      `Gemini OCR image processing failed: ${lastError?.message || 'Unable to extract text from image.'}`,
      400,
      'OCR_PROCESSING_FAILED'
    );
  }
}
