export const validateComparisonOutput = (rawOutput) => {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return {
      isValid: false,
      errors: ['AI comparison output is not a valid JSON object.']
    };
  }

  const {
    improvedConcepts,
    unchangedWeaknesses,
    newlyObservedWeaknesses,
    resolvedMisconceptions,
    remainingMisconceptions,
    conceptualDelta,
    proceduralDelta,
    applicationDelta,
    overallScoreDelta,
    evidenceSummary,
    remediationEffectiveness,
    summary
  } = rawOutput;

  if (!Array.isArray(improvedConcepts)) {
    errors.push('improvedConcepts must be an array of strings.');
  }

  if (!Array.isArray(unchangedWeaknesses)) {
    errors.push('unchangedWeaknesses must be an array of strings.');
  }

  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    errors.push('Comparison summary is missing or empty.');
  }

  const validStatuses = ['improved', 'persistent_weakness', 'unchanged', 'insufficient_evidence'];

  const sanitizedEvidenceSummary = Array.isArray(evidenceSummary)
    ? evidenceSummary.map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        return {
          concept: item.concept && typeof item.concept === 'string' ? item.concept.trim() : `Concept #${idx + 1}`,
          initialEvidence: item.initialEvidence && typeof item.initialEvidence === 'string' ? item.initialEvidence.trim() : 'Diagnosed concept deficiency',
          reassessmentEvidence: item.reassessmentEvidence && typeof item.reassessmentEvidence === 'string' ? item.reassessmentEvidence.trim() : 'Reassessment response evaluated',
          status: item.status && validStatuses.includes(item.status) ? item.status : 'improved',
          reasoning: item.reasoning && typeof item.reasoning === 'string' ? item.reasoning.trim() : 'Evidence-based analysis.'
        };
      }).filter(Boolean)
    : [];

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }

  return {
    isValid: true,
    sanitizedComparison: {
      improvedConcepts: improvedConcepts.map((c) => c.toString().trim()).filter(Boolean),
      unchangedWeaknesses: Array.isArray(unchangedWeaknesses) ? unchangedWeaknesses.map((c) => c.toString().trim()).filter(Boolean) : [],
      newlyObservedWeaknesses: Array.isArray(newlyObservedWeaknesses) ? newlyObservedWeaknesses.map((c) => c.toString().trim()).filter(Boolean) : [],
      resolvedMisconceptions: Array.isArray(resolvedMisconceptions) ? resolvedMisconceptions.map((c) => c.toString().trim()).filter(Boolean) : [],
      remainingMisconceptions: Array.isArray(remainingMisconceptions) ? remainingMisconceptions.map((c) => c.toString().trim()).filter(Boolean) : [],
      conceptualDelta: typeof conceptualDelta === 'number' ? Math.round(conceptualDelta * 100) / 100 : 0,
      proceduralDelta: typeof proceduralDelta === 'number' ? Math.round(proceduralDelta * 100) / 100 : 0,
      applicationDelta: typeof applicationDelta === 'number' ? Math.round(applicationDelta * 100) / 100 : 0,
      overallScoreDelta: typeof overallScoreDelta === 'number' ? Math.round(overallScoreDelta * 100) / 100 : 0,
      evidenceSummary: sanitizedEvidenceSummary,
      remediationEffectiveness: remediationEffectiveness && typeof remediationEffectiveness === 'string' ? remediationEffectiveness.trim() : 'Evidence suggests improvement following completed remediation activities.',
      summary: summary.trim()
    }
  };
};
