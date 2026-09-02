export const validateLLMAssessmentOutput = (rawOutput, sourceMaterials = []) => {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return {
      isValid: false,
      errors: ['LLM output is not a valid JSON object.']
    };
  }

  const { title, difficulty, questions } = rawOutput;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Assessment title is missing or invalid.');
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Assessment questions array is missing or empty.');
    return { isValid: false, errors };
  }

  const validQuestionTypes = ['mcq', 'short_answer', 'code'];
  const validDifficulties = ['easy', 'medium', 'hard'];
  const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim());

  const sanitizedQuestions = questions.map((q, idx) => {
    const qIndexStr = `Question #${idx + 1}`;

    if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
      errors.push(`${qIndexStr}: questionText is missing or empty.`);
    }

    if (!q.questionType || !validQuestionTypes.includes(q.questionType)) {
      errors.push(`${qIndexStr}: questionType "${q.questionType}" is invalid. Expected one of: ${validQuestionTypes.join(', ')}.`);
    }

    if (q.questionType === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`${qIndexStr}: MCQ questions must contain at least 2 options.`);
      }
    }

    if (!q.correctAnswer || typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) {
      errors.push(`${qIndexStr}: correctAnswer is missing or empty.`);
    }

    const qDifficulty = q.difficulty && validDifficulties.includes(q.difficulty) ? q.difficulty : 'medium';

    if (!Array.isArray(q.expectedConcepts) || q.expectedConcepts.length === 0) {
      errors.push(`${qIndexStr}: expectedConcepts must be a non-empty array of strings.`);
    }

    if (!q.rubric || typeof q.rubric !== 'object') {
      errors.push(`${qIndexStr}: rubric object is missing.`);
    } else {
      if (!q.rubric.gradingCriteria || typeof q.rubric.gradingCriteria !== 'string') {
        errors.push(`${qIndexStr}: rubric.gradingCriteria is missing.`);
      }
      if (!q.rubric.sampleAnswer || typeof q.rubric.sampleAnswer !== 'string') {
        errors.push(`${qIndexStr}: rubric.sampleAnswer is missing.`);
      }
    }

    const sanitizedSourceRefs = Array.isArray(q.sourceReferences)
      ? q.sourceReferences
          .map((sr) => {
            if (!sr || typeof sr !== 'object') return null;
            let matId = sr.materialId && typeof sr.materialId === 'string' ? sr.materialId.trim() : null;

            if (matId && !isValidObjectId(matId) && Array.isArray(sourceMaterials)) {
              const matched = sourceMaterials.find(
                (sm) =>
                  (sm.originalName && sm.originalName.toLowerCase() === matId.toLowerCase()) ||
                  (sm.title && sm.title.toLowerCase() === matId.toLowerCase()) ||
                  sm.materialId?.toString() === matId
              );
              if (matched) {
                matId = matched.materialId ? matched.materialId.toString() : matched._id ? matched._id.toString() : null;
              }
            }

            if (!isValidObjectId(matId) && Array.isArray(sourceMaterials) && sourceMaterials.length > 0) {
              const fallback = sourceMaterials[0];
              matId = fallback.materialId ? fallback.materialId.toString() : fallback._id ? fallback._id.toString() : null;
            }

            if (!isValidObjectId(matId)) {
              return null;
            }

            return {
              materialId: matId,
              pageNumber: typeof sr.pageNumber === 'number' && sr.pageNumber >= 1 ? sr.pageNumber : 1,
              chunkIndex: typeof sr.chunkIndex === 'number' && sr.chunkIndex >= 0 ? sr.chunkIndex : 0
            };
          })
          .filter(Boolean)
      : [];

    return {
      questionText: q.questionText ? q.questionText.trim() : '',
      questionType: q.questionType,
      options: Array.isArray(q.options) ? q.options.map((o) => o.toString().trim()) : [],
      correctAnswer: q.correctAnswer ? q.correctAnswer.trim() : '',
      difficulty: qDifficulty,
      expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts.map((c) => c.toString().trim()) : [],
      rubric: {
        gradingCriteria: q.rubric?.gradingCriteria ? q.rubric.gradingCriteria.trim() : 'Evaluates conceptual understanding.',
        sampleAnswer: q.rubric?.sampleAnswer ? q.rubric.sampleAnswer.trim() : (q.correctAnswer || ''),
        maxPoints: typeof q.rubric?.maxPoints === 'number' ? q.rubric.maxPoints : 1
      },
      sourceReferences: sanitizedSourceRefs
    };
  });

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }

  return {
    isValid: true,
    sanitizedAssessment: {
      title: title.trim(),
      difficulty: validDifficulties.includes(difficulty) || difficulty === 'mixed' ? difficulty : 'medium',
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions
    }
  };
};
