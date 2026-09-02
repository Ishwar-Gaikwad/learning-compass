import { GoogleGenAI } from '@google/genai';
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { aiObservabilityService } from './aiObservabilityService.js';

export class GeminiLLMProvider extends BaseLLMProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.modelName = options.modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    this.timeoutMs = options.timeoutMs || 25000; // 25s bounded timeout per call

    if (this.apiKey && this.apiKey.trim().length > 0) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey.trim() });
    }
  }

  setSimulatedInvalidOutput(shouldFail) {
    this._simulatedInvalidOutput = shouldFail;
  }

  getModelName() {
    return this.modelName;
  }

  cleanJSONString(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let cleaned = rawText.trim();
    // Remove markdown code fences if present (e.g. ```json ... ```)
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }
    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    return cleaned.trim();
  }

  inferOperation(prompt = '') {
    const p = prompt.toUpperCase();
    if (p.includes('REASSESSMENT')) return 'reassessment_generation';
    if (p.includes('ASSESSMENT')) return 'assessment_generation';
    if (p.includes('DIAGNOSTIC')) return 'diagnostic_analysis';
    if (p.includes('LEARNING PATH')) return 'learning_path_generation';
    if (p.includes('IMPROVEMENT') || p.includes('COMPARISON')) return 'improvement_analysis';
    if (p.includes('EVALUATION') || p.includes('RUBRIC')) return 'response_evaluation';
    return 'llm_generation';
  }

  getCandidateModels() {
    return Array.from(
      new Set(
        [
          this.modelName,
          process.env.GEMINI_MODEL,
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.6-flash',
          'gemini-3.7-flash'
        ].filter(Boolean)
      )
    );
  }

  classifyError(err) {
    if (!err) return { isTransient: false, category: 'UNKNOWN_ERROR' };
    const msg = (err.message || '').toString();
    const status = err.status || err.statusCode || 0;

    // 1. NON-TRANSIENT AUTH / CONFIG ERRORS
    if (
      msg.includes('API_KEY_INVALID') ||
      msg.includes('invalid API key') ||
      msg.includes('API key not valid') ||
      msg.includes('UNAUTHENTICATED') ||
      status === 401 ||
      (status === 403 && !msg.includes('Quota'))
    ) {
      return { isTransient: false, category: 'NON_TRANSIENT_AUTH_ERROR' };
    }

    // 2. NON-TRANSIENT INVALID REQUEST / MALFORMED PROMPT
    if (
      msg.includes('INVALID_ARGUMENT') ||
      msg.includes('invalid prompt') ||
      (status === 400 && !msg.includes('Quota'))
    ) {
      return { isTransient: false, category: 'NON_TRANSIENT_INVALID_REQUEST' };
    }

    // 3. MODEL NOT FOUND / UNSUPPORTED (Candidate-level — allows model candidate fallback)
    if (
      msg.includes('NOT_FOUND') ||
      msg.includes('404') ||
      msg.includes('no longer available') ||
      msg.includes('is not found for API version')
    ) {
      return { isTransient: true, isModelUnavailable: true, category: 'MODEL_UNAVAILABLE' };
    }

    // 4. TRANSIENT RATE LIMIT / QUOTA EXCEEDED
    if (
      msg.includes('429') ||
      msg.includes('Quota exceeded') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('rate limit')
    ) {
      return { isTransient: true, isRateLimit: true, category: 'TRANSIENT_RATE_LIMIT' };
    }

    // 5. TRANSIENT TIMEOUT
    if (
      msg.includes('TIMEOUT') ||
      msg.includes('timed out') ||
      msg.includes('AbortError') ||
      err.name === 'AbortError'
    ) {
      return { isTransient: true, category: 'TRANSIENT_TIMEOUT' };
    }

    // 6. TRANSIENT SERVER ERROR / NETWORK ISSUE
    if (
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('fetch failed') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT')
    ) {
      return { isTransient: true, category: 'TRANSIENT_SERVER_ERROR' };
    }

    // 7. TRANSIENT MALFORMED JSON OUTPUT (LLM generation glitch — candidate retry/fallback supported)
    if (
      err instanceof SyntaxError ||
      err?.name === 'SyntaxError' ||
      msg.includes('Unexpected token') ||
      msg.includes('is not valid JSON') ||
      msg.includes('Bad escaped character') ||
      msg.includes('JSON at position')
    ) {
      return { isTransient: true, category: 'TRANSIENT_MALFORMED_JSON' };
    }

    return { isTransient: false, category: 'NON_TRANSIENT_UNKNOWN_ERROR' };
  }

  calculateBackoffDelay(attempt, err) {
    const msg = err?.message || '';
    const retryMatch = msg.match(/Please retry in ([0-9.]+)s/) || msg.match(/retryDelay":"([0-9]+)s"/);
    if (retryMatch) {
      return Math.ceil(parseFloat(retryMatch[1])) * 1000 + 500;
    }
    // Exponential backoff: 1s, 2s, 4s... max 10s
    const baseDelay = 1000;
    const expDelay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(expDelay, 10000);
  }

  async withTimeout(promiseFn, timeoutMs = 25000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await Promise.race([
        promiseFn(controller.signal),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            const err = new Error(`Gemini LLM request timed out after ${timeoutMs}ms.`);
            err.name = 'AbortError';
            reject(err);
          });
        })
      ]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async generateText({ prompt, systemPrompt, temperature = 0.2, options = {} }) {
    if (!this.apiKey || !this.ai) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }

    if (this._simulatedInvalidOutput) {
      return { invalid: "malformed JSON output" };
    }

    const startTime = Date.now();
    const operation = options.operation || this.inferOperation(prompt);
    const requestId = options.requestId || aiObservabilityService.generateRequestId();
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const candidates = this.getCandidateModels();

    let lastError = null;
    let totalRetries = 0;
    let fallbackUsed = false;

    for (let idx = 0; idx < candidates.length; idx++) {
      const modelCandidate = candidates[idx];
      if (idx > 0) fallbackUsed = true;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await this.withTimeout(
            (signal) =>
              this.ai.models.generateContent({
                model: modelCandidate,
                contents: fullPrompt,
                config: { temperature }
              }),
            this.timeoutMs
          );

          const latencyMs = Date.now() - startTime;
          const usage = response.usageMetadata || {};

          aiObservabilityService.recordCall({
            requestId,
            operation,
            modelName: modelCandidate,
            latencyMs,
            status: 'success',
            retrievedChunkCount: options.retrievedChunkCount || 0,
            validationResult: 'VALID',
            retryCount: totalRetries,
            fallbackUsed,
            tokenUsage: {
              promptTokens: usage.promptTokenCount || 0,
              candidateTokens: usage.candidatesTokenCount || 0,
              totalTokens: usage.totalTokenCount || 0
            }
          });

          return response.text ? response.text.trim() : '';
        } catch (err) {
          lastError = err;
          totalRetries++;

          const classification = this.classifyError(err);

          // NON-TRANSIENT ERRORS (Invalid API key, bad prompt) -> Fail immediately, NO retries, NO fallback!
          if (!classification.isTransient) {
            console.error(`[GeminiLLMProvider] Non-transient error encountered (${classification.category}): ${err.message}. Aborting retries immediately.`);
            
            aiObservabilityService.recordCall({
              requestId,
              operation,
              modelName: modelCandidate,
              latencyMs: Date.now() - startTime,
              status: 'failure',
              errorCategory: classification.category,
              retrievedChunkCount: options.retrievedChunkCount || 0,
              validationResult: 'INVALID',
              retryCount: totalRetries,
              fallbackUsed
            });

            throw new Error(`Gemini LLM Non-Transient Failure [${classification.category}]: ${err.message}`);
          }

          // MODEL UNAVAILABLE / RATE LIMIT / 5XX -> Try next candidate model
          if (classification.isModelUnavailable || classification.isRateLimit || classification.category === 'TRANSIENT_SERVER_ERROR') {
            console.warn(`[GeminiLLMProvider] Model ${modelCandidate} hit ${classification.category}. Switching to next candidate model...`);
            break; // Break inner loop to try next model candidate
          }

          // TRANSIENT TIMEOUT -> Retry with exponential backoff on same model
          if (attempt < 2) {
            const backoffMs = this.calculateBackoffDelay(attempt, err);
            console.warn(`[GeminiLLMProvider] Transient ${classification.category} on ${modelCandidate} (attempt ${attempt}/2). Retrying in ${backoffMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const finalClassification = this.classifyError(lastError);

    aiObservabilityService.recordCall({
      requestId,
      operation,
      modelName: candidates[0],
      latencyMs,
      status: 'failure',
      errorCategory: finalClassification.category,
      retrievedChunkCount: options.retrievedChunkCount || 0,
      validationResult: 'INVALID',
      retryCount: totalRetries,
      fallbackUsed
    });

    throw new Error(`Gemini LLM Generation Failed: ${lastError?.message || 'All model candidates exhausted'}`);
  }

  async generateStructuredJSON({ prompt, systemPrompt, temperature = 0.1, options = {} }) {
    if (options) {
      if (options.mockComparisonResponse && (prompt.includes('IMPROVEMENT') || prompt.includes('COMPARISON'))) {
        return options.mockComparisonResponse;
      }
      if (options.mockDiagnosticResponse && prompt.includes('DIAGNOSTIC')) {
        return options.mockDiagnosticResponse;
      }
      if (options.mockReassessmentResponse && prompt.includes('REASSESSMENT')) {
        return options.mockReassessmentResponse;
      }
      if (options.mockAssessmentResponse && (prompt.includes('ASSESSMENT') || prompt.includes('REASSESSMENT'))) {
        return options.mockAssessmentResponse;
      }
      if (options.mockLPResponse && prompt.includes('LEARNING PATH')) {
        return options.mockLPResponse;
      }
      if (options.mockLLMResponse) {
        return options.mockLLMResponse;
      }
    }

    if (!this.apiKey || !this.ai) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }

    const startTime = Date.now();
    const operation = options.operation || this.inferOperation(prompt);
    const requestId = options.requestId || aiObservabilityService.generateRequestId();

    const instruction = 'You MUST respond with valid JSON ONLY. Do not include markdown code block formatting, explanation, or commentary outside the JSON object.';
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${instruction}\n\nUSER PROMPT:\n${prompt}`
      : `${instruction}\n\nUSER PROMPT:\n${prompt}`;

    const candidates = this.getCandidateModels();
    let lastError = null;
    let totalRetries = 0;
    let fallbackUsed = false;

    for (let idx = 0; idx < candidates.length; idx++) {
      const modelCandidate = candidates[idx];
      if (idx > 0) fallbackUsed = true;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (options && options.mockErrorSequence && options.mockErrorSequence.length > 0) {
            const mockItem = options.mockErrorSequence.shift();
            if (mockItem instanceof Error || (typeof mockItem === 'object' && mockItem.error)) {
              throw (mockItem instanceof Error ? mockItem : new Error(mockItem.error));
            }
            return mockItem;
          }

          const response = await this.withTimeout(
            (signal) =>
              this.ai.models.generateContent({
                model: modelCandidate,
                contents: fullPrompt,
                config: {
                  temperature,
                  responseMimeType: 'application/json'
                }
              }),
            this.timeoutMs
          );

          const rawText = response.text ? response.text.trim() : '';
          const cleanedText = this.cleanJSONString(rawText);

          if (!cleanedText) {
            throw new Error(`Model ${modelCandidate} returned empty text output.`);
          }

          let parsedJSON = null;
          try {
            parsedJSON = JSON.parse(cleanedText);
          } catch (err1) {
            const jsonMatch = cleanedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
              try {
                parsedJSON = JSON.parse(jsonMatch[1]);
              } catch (err2) {
                throw err1;
              }
            } else {
              throw err1;
            }
          }
          const latencyMs = Date.now() - startTime;
          const usage = response.usageMetadata || {};

          aiObservabilityService.recordCall({
            requestId,
            operation,
            modelName: modelCandidate,
            latencyMs,
            status: 'success',
            retrievedChunkCount: options.retrievedChunkCount || 0,
            validationResult: 'VALID',
            retryCount: totalRetries,
            fallbackUsed,
            tokenUsage: {
              promptTokens: usage.promptTokenCount || 0,
              candidateTokens: usage.candidatesTokenCount || 0,
              totalTokens: usage.totalTokenCount || 0
            }
          });

          return parsedJSON;
        } catch (err) {
          lastError = err;
          totalRetries++;

          const classification = this.classifyError(err);

          // NON-TRANSIENT ERRORS (Invalid API key, bad prompt) -> Fail immediately, NO retries, NO fallback!
          if (!classification.isTransient) {
            console.error(`[GeminiLLMProvider] Non-transient error encountered (${classification.category}): ${err.message}. Aborting retries immediately.`);

            aiObservabilityService.recordCall({
              requestId,
              operation,
              modelName: modelCandidate,
              latencyMs: Date.now() - startTime,
              status: 'failure',
              errorCategory: classification.category,
              retrievedChunkCount: options.retrievedChunkCount || 0,
              validationResult: 'INVALID',
              retryCount: totalRetries,
              fallbackUsed
            });

            throw new Error(`Gemini LLM Non-Transient Failure [${classification.category}]: ${err.message}`);
          }

          // MODEL UNAVAILABLE / RATE LIMIT / 5XX -> Try next candidate model
          if (
            classification.isModelUnavailable ||
            classification.isRateLimit ||
            classification.category === 'TRANSIENT_SERVER_ERROR'
          ) {
            console.warn(`[GeminiLLMProvider] Model ${modelCandidate} hit ${classification.category}. Switching to next candidate model...`);
            break; // Try next candidate model
          }

          // TRANSIENT TIMEOUT / MALFORMED JSON -> Retry attempt on same model candidate
          if (attempt < 2) {
            const backoffMs = this.calculateBackoffDelay(attempt, err);
            console.warn(`[GeminiLLMProvider] Transient ${classification.category} on ${modelCandidate} (attempt ${attempt}/2). Retrying in ${backoffMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          break;
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const finalClassification = this.classifyError(lastError);

    aiObservabilityService.recordCall({
      requestId,
      operation,
      modelName: candidates[0],
      latencyMs,
      status: 'failure',
      errorCategory: lastError?.message?.includes('JSON') ? 'MALFORMED_JSON' : finalClassification.category,
      retrievedChunkCount: options.retrievedChunkCount || 0,
      validationResult: 'INVALID',
      retryCount: totalRetries,
      fallbackUsed
    });

    throw new Error(`Gemini LLM Generation Failed: ${lastError?.message || 'All model candidates exhausted'}`);
  }
}
