export const validateEvaluationOutput = (rawOutput, maxPoints = 1) => {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return {
      isValid: false,
      errors: ['AI evaluation output is not a valid JSON object.']
    };
  }

  const {
    correctness,
    score,
    conceptualUnderstanding,
    proceduralFluency,
    applicationTransfer,
    identifiedConcepts,
    missingConcepts,
    misconceptions,
    reasoning
  } = rawOutput;

  const validCorrectness = ['correct', 'partially_correct', 'incorrect'];
  if (!correctness || !validCorrectness.includes(correctness)) {
    errors.push(`correctness "${correctness}" is invalid. Expected one of: ${validCorrectness.join(', ')}.`);
  }

  const numScore = typeof score === 'number' ? score : parseFloat(score);
  if (isNaN(numScore) || numScore < 0 || numScore > maxPoints) {
    errors.push(`score "${score}" is invalid. Must be a number between 0 and ${maxPoints}.`);
  }

  const parseScoreDimension = (val, name) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num < 0 || num > 1) {
      errors.push(`${name} "${val}" is invalid. Must be a number between 0.0 and 1.0.`);
      return 0.0;
    }
    return Math.round(num * 100) / 100;
  };

  const sanitizedConceptual = parseScoreDimension(conceptualUnderstanding, 'conceptualUnderstanding');
  const sanitizedProcedural = parseScoreDimension(proceduralFluency, 'proceduralFluency');
  const sanitizedApplication = parseScoreDimension(applicationTransfer, 'applicationTransfer');

  if (!Array.isArray(identifiedConcepts)) {
    errors.push('identifiedConcepts must be an array of strings.');
  }

  if (!Array.isArray(missingConcepts)) {
    errors.push('missingConcepts must be an array of strings.');
  }

  if (!Array.isArray(misconceptions)) {
    errors.push('misconceptions must be an array.');
  }

  if (!reasoning || typeof reasoning !== 'string' || reasoning.trim().length === 0) {
    errors.push('reasoning evidence is missing or empty.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }

  const sanitizedMisconceptions = misconceptions.map((m) => {
    if (typeof m === 'string') {
      return { tag: 'MISCONCEPTION', description: m.trim() };
    }
    return {
      tag: m.tag ? m.tag.toString().trim() : 'MISCONCEPTION',
      description: m.description ? m.description.toString().trim() : (m.tag || 'Unspecified misconception')
    };
  });

  return {
    isValid: true,
    sanitizedEvaluation: {
      correctness,
      score: Math.min(Math.max(0, numScore), maxPoints),
      maxScore: maxPoints,
      conceptualUnderstanding: sanitizedConceptual,
      proceduralFluency: sanitizedProcedural,
      applicationTransfer: sanitizedApplication,
      identifiedConcepts: identifiedConcepts.map((c) => c.toString().trim()),
      missingConcepts: missingConcepts.map((m) => m.toString().trim()),
      misconceptions: sanitizedMisconceptions,
      reasoning: reasoning.trim(),
      evaluatedAt: new Date()
    }
  };
};
