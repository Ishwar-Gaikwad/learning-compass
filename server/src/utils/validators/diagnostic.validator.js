export const validateDiagnosticOutput = (rawOutput) => {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return {
      isValid: false,
      errors: ['Diagnostic output is not a valid JSON object.']
    };
  }

  const {
    overallMasteryScore,
    masteryLevel,
    dimensionScores,
    strengths,
    weakConcepts,
    proceduralWeaknesses,
    applicationWeaknesses,
    identifiedMisconceptions,
    recommendations,
    aiSummary
  } = rawOutput;

  const validMasteryLevels = ['novice', 'developing', 'proficient', 'mastered'];
  const numScore = typeof overallMasteryScore === 'number' ? overallMasteryScore : parseFloat(overallMasteryScore);

  if (isNaN(numScore) || numScore < 0 || numScore > 100) {
    errors.push(`overallMasteryScore "${overallMasteryScore}" is invalid. Must be between 0 and 100.`);
  }

  const sanitizedLevel = validMasteryLevels.includes(masteryLevel) ? masteryLevel : 'developing';

  if (!dimensionScores || typeof dimensionScores !== 'object') {
    errors.push('dimensionScores object is missing.');
  }

  if (!Array.isArray(strengths)) {
    errors.push('strengths must be an array.');
  }

  if (!Array.isArray(weakConcepts)) {
    errors.push('weakConcepts must be an array.');
  }

  if (!Array.isArray(identifiedMisconceptions)) {
    errors.push('identifiedMisconceptions must be an array.');
  }

  if (!aiSummary || typeof aiSummary !== 'string' || aiSummary.trim().length === 0) {
    errors.push('aiSummary is missing or empty.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }

  const sanitizeEvidenceItem = (item, defaultKey = 'concept') => {
    if (typeof item === 'string') {
      return { [defaultKey]: item.trim(), evidence: 'Derived from response evaluation.' };
    }
    return {
      [defaultKey]: item[defaultKey] ? item[defaultKey].toString().trim() : (item.description || 'Unspecified concept'),
      evidence: item.evidence ? item.evidence.toString().trim() : 'Derived from evaluated response.',
      questionId: item.questionId,
      responseId: item.responseId
    };
  };

  return {
    isValid: true,
    sanitizedReport: {
      overallMasteryScore: Math.round(Math.min(Math.max(0, numScore), 100)),
      masteryLevel: sanitizedLevel,
      dimensionScores: {
        conceptualUnderstanding: typeof dimensionScores?.conceptualUnderstanding === 'number' ? dimensionScores.conceptualUnderstanding : 0,
        proceduralFluency: typeof dimensionScores?.proceduralFluency === 'number' ? dimensionScores.proceduralFluency : 0,
        applicationTransfer: typeof dimensionScores?.applicationTransfer === 'number' ? dimensionScores.applicationTransfer : 0
      },
      strengths: strengths.map((s) => sanitizeEvidenceItem(s, 'concept')),
      weakConcepts: weakConcepts.map((w) => {
        const item = sanitizeEvidenceItem(w, 'concept');
        return {
          ...item,
          severity: ['low', 'medium', 'high'].includes(w.severity) ? w.severity : 'medium'
        };
      }),
      proceduralWeaknesses: Array.isArray(proceduralWeaknesses)
        ? proceduralWeaknesses.map((pw) => sanitizeEvidenceItem(pw, 'description'))
        : [],
      applicationWeaknesses: Array.isArray(applicationWeaknesses)
        ? applicationWeaknesses.map((aw) => sanitizeEvidenceItem(aw, 'description'))
        : [],
      identifiedMisconceptions: identifiedMisconceptions.map((m) => ({
        misconceptionCode: m.misconceptionCode || m.tag || 'MISCONCEPTION',
        title: m.title || m.tag || 'Diagnosed Misconception',
        explanation: m.explanation || m.description || 'Identified from student response error pattern.',
        severity: ['low', 'medium', 'high'].includes(m.severity) ? m.severity : 'medium',
        evidenceQuestions: Array.isArray(m.evidenceQuestions) ? m.evidenceQuestions : [],
        responseId: m.responseId
      })),
      recommendations: Array.isArray(recommendations) ? recommendations.map((r) => r.toString().trim()) : [],
      aiSummary: aiSummary.trim()
    }
  };
};
