import crypto from 'crypto';

class AIObservabilityService {
  constructor() {
    this.logs = [];
    this.operationStats = {};
  }

  generateRequestId(prefix = 'req-ai') {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  }

  sanitizeData(data) {
    if (!data) return data;
    if (typeof data === 'string') {
      let sanitized = data;
      // Mask API keys, tokens, passwords
      sanitized = sanitized.replace(/(AIzaSy[A-Za-z0-9_-]{33})/g, 'AIzaSy***');
      sanitized = sanitized.replace(/(bearer\s+[A-Za-z0-9._-]+)/gi, 'Bearer ***');
      sanitized = sanitized.replace(/("password"\s*:\s*")[^"]+"/gi, '"password":"***"');
      return sanitized;
    }
    if (typeof data === 'object') {
      const copy = Array.isArray(data) ? [] : {};
      for (const [key, value] of Object.entries(data)) {
        if (['password', 'apiKey', 'token', 'secret', 'authorization'].includes(key)) {
          copy[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
          copy[key] = this.sanitizeData(value);
        } else if (typeof value === 'string') {
          copy[key] = this.sanitizeData(value);
        } else {
          copy[key] = value;
        }
      }
      return copy;
    }
    return data;
  }

  calculateCost({ promptTokens = 0, candidateTokens = 0 }) {
    // Gemini 3.6 Flash estimated pricing: $0.075 per 1M prompt tokens, $0.30 per 1M candidate tokens
    const promptCost = (promptTokens / 1_000_000) * 0.075;
    const candidateCost = (candidateTokens / 1_000_000) * 0.30;
    return Number((promptCost + candidateCost).toFixed(6));
  }

  recordCall(logEntry = {}) {
    const requestId = logEntry.requestId || this.generateRequestId();
    const operation = logEntry.operation || 'llm_generation';
    const modelName = logEntry.modelName || 'gemini-3.6-flash';
    const latencyMs = logEntry.latencyMs || 0;
    const status = logEntry.status || 'success';
    const errorCategory = logEntry.errorCategory || (status === 'success' ? null : 'UNKNOWN_ERROR');
    const retrievedChunkCount = logEntry.retrievedChunkCount || 0;
    const validationResult = logEntry.validationResult || (status === 'success' ? 'VALID' : 'INVALID');
    const retryCount = logEntry.retryCount || 0;
    const fallbackUsed = Boolean(logEntry.fallbackUsed);
    const tokenUsage = {
      promptTokens: logEntry.tokenUsage?.promptTokens || logEntry.tokenUsage?.promptTokenCount || 0,
      candidateTokens: logEntry.tokenUsage?.candidateTokens || logEntry.tokenUsage?.candidatesTokenCount || 0,
      totalTokens: logEntry.tokenUsage?.totalTokens || logEntry.tokenUsage?.totalTokenCount || 0
    };
    const estimatedCost = this.calculateCost(tokenUsage);

    const record = {
      requestId,
      operation,
      modelName,
      latencyMs,
      status,
      errorCategory,
      retrievedChunkCount,
      validationResult,
      retryCount,
      fallbackUsed,
      tokenUsage,
      estimatedCost,
      timestamp: new Date().toISOString()
    };

    this.logs.push(record);

    // Update in-memory stats
    if (!this.operationStats[operation]) {
      this.operationStats[operation] = {
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        latencies: [],
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        retryCounts: 0,
        fallbackCounts: 0
      };
    }

    const stats = this.operationStats[operation];
    stats.totalCalls += 1;
    if (status === 'success') {
      stats.successCount += 1;
    } else {
      stats.failureCount += 1;
    }
    stats.latencies.push(latencyMs);
    stats.promptTokens += tokenUsage.promptTokens;
    stats.candidateTokens += tokenUsage.candidateTokens;
    stats.totalTokens += tokenUsage.totalTokens;
    stats.totalCost += estimatedCost;
    stats.retryCounts += retryCount;
    if (fallbackUsed) stats.fallbackCounts += 1;

    // Safe development/production log
    const logMsg = `[AI_OBSERVABILITY] req:${requestId} | op:${operation} | model:${modelName} | lat:${latencyMs}ms | status:${status} | fallback:${fallbackUsed} | chunks:${retrievedChunkCount} | tokens:${tokenUsage.totalTokens} | cost:$${estimatedCost}`;
    if (status === 'success') {
      console.log(logMsg);
    } else {
      console.warn(`${logMsg} | err:${errorCategory}`);
    }

    return record;
  }

  getSummaryMetrics() {
    const summary = {
      totalOperations: this.logs.length,
      operations: {}
    };

    let grandTotalTokens = 0;
    let grandTotalCost = 0;

    for (const [op, stats] of Object.entries(this.operationStats)) {
      const latencies = stats.latencies;
      const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
      const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
      const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

      grandTotalTokens += stats.totalTokens;
      grandTotalCost += stats.totalCost;

      summary.operations[op] = {
        totalCalls: stats.totalCalls,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        avgLatencyMs: avgLatency,
        promptTokens: stats.promptTokens,
        candidateTokens: stats.candidateTokens,
        totalTokens: stats.totalTokens,
        totalCost: Number(stats.totalCost.toFixed(6)),
        retryCount: stats.retryCounts
      };
    }

    summary.grandTotalTokens = grandTotalTokens;
    summary.grandTotalCost = Number(grandTotalCost.toFixed(6));

    return summary;
  }

  clearLogs() {
    this.logs = [];
    this.operationStats = {};
  }
}

export const aiObservabilityService = new AIObservabilityService();
