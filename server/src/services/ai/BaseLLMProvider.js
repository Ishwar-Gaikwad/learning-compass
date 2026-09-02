export class BaseLLMProvider {
  async generateText({ prompt, systemPrompt, temperature }) {
    throw new Error('Method generateText() must be implemented by LLMProvider subclass.');
  }

  async generateStructuredJSON({ prompt, systemPrompt, temperature }) {
    throw new Error('Method generateStructuredJSON() must be implemented by LLMProvider subclass.');
  }

  getModelName() {
    throw new Error('Method getModelName() must be implemented by LLMProvider subclass.');
  }
}
