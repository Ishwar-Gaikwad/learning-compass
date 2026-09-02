import { BaseLLMProvider } from './BaseLLMProvider.js';

export class OpenAILLMProvider extends BaseLLMProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.modelName = options.modelName || process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  getModelName() {
    return this.modelName;
  }

  async generateText({ prompt, systemPrompt, temperature = 0.2 }) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateStructuredJSON({ prompt, systemPrompt, temperature = 0.1 }) {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Structured JSON API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    return JSON.parse(rawContent);
  }
}
