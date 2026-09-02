import { LocalLLMProvider } from './LocalLLMProvider.js';
import { OpenAILLMProvider } from './OpenAILLMProvider.js';
import { GeminiLLMProvider } from './GeminiLLMProvider.js';
import { aiObservabilityService } from './aiObservabilityService.js';

class LLMService {
  constructor() {
    this._provider = null;
  }

  setProvider(providerInstance) {
    this._provider = providerInstance;
  }

  getProvider() {
    if (this._provider) return this._provider;
    const providerType = process.env.LLM_PROVIDER || 'gemini';
    if (process.env.GEMINI_API_KEY || providerType === 'gemini') {
      return new GeminiLLMProvider();
    } else if (process.env.OPENAI_API_KEY || providerType === 'openai') {
      return new OpenAILLMProvider();
    }
    return new LocalLLMProvider();
  }

  getModelName() {
    return this.getProvider().getModelName();
  }

  async generateText({ prompt, systemPrompt, temperature, options }) {
    return await this.getProvider().generateText({ prompt, systemPrompt, temperature, options });
  }

  async generateStructuredJSON({ prompt, systemPrompt, temperature, options }) {
    return await this.getProvider().generateStructuredJSON({ prompt, systemPrompt, temperature, options });
  }

  getObservabilitySummary() {
    return aiObservabilityService.getSummaryMetrics();
  }
}

export const llmService = new LLMService();

