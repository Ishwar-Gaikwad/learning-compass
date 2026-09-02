export const validateLearningPathOutput = (rawOutput) => {
  const errors = [];

  if (!rawOutput || typeof rawOutput !== 'object') {
    return {
      isValid: false,
      errors: ['Learning path output is not a valid JSON object.']
    };
  }

  const { title, nodes } = rawOutput;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Learning path title is missing or empty.');
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Learning path nodes array is missing or empty.');
    return { isValid: false, errors };
  }

  const validDifficulties = ['easy', 'medium', 'hard'];
  const validTypes = ['remedial_reading', 'practice_exercise', 'concept_explanation', 'checkpoint_quiz'];

  const sanitizedNodes = nodes.map((node, idx) => {
    const nodeLabel = `Node #${idx + 1}`;

    if (!node.targetConcept || typeof node.targetConcept !== 'string' || node.targetConcept.trim().length === 0) {
      errors.push(`${nodeLabel}: targetConcept is missing or empty.`);
    }

    if (!node.reasonForTargeting || typeof node.reasonForTargeting !== 'string' || node.reasonForTargeting.trim().length === 0) {
      errors.push(`${nodeLabel}: reasonForTargeting is missing or empty.`);
    }

    if (!node.learningObjective || typeof node.learningObjective !== 'string' || node.learningObjective.trim().length === 0) {
      errors.push(`${nodeLabel}: learningObjective is missing or empty.`);
    }

    if (!node.expectedOutcome || typeof node.expectedOutcome !== 'string' || node.expectedOutcome.trim().length === 0) {
      errors.push(`${nodeLabel}: expectedOutcome is missing or empty.`);
    }

    if (!node.reassessmentCriteria || typeof node.reassessmentCriteria !== 'string' || node.reassessmentCriteria.trim().length === 0) {
      errors.push(`${nodeLabel}: reassessmentCriteria is missing or empty.`);
    }

    const difficulty = validDifficulties.includes(node.difficulty) ? node.difficulty : 'medium';
    const type = validTypes.includes(node.type) ? node.type : 'remedial_reading';

    return {
      nodeId: node.nodeId || `node_${idx + 1}_${Date.now()}`,
      sequenceOrder: typeof node.sequenceOrder === 'number' ? node.sequenceOrder : idx + 1,
      title: node.title ? node.title.trim() : `Remediation: ${node.targetConcept || 'Concept'}`,
      type,
      targetConcept: node.targetConcept ? node.targetConcept.trim() : '',
      reasonForTargeting: node.reasonForTargeting ? node.reasonForTargeting.trim() : '',
      learningObjective: node.learningObjective ? node.learningObjective.trim() : '',
      recommendedMaterial: node.recommendedMaterial && typeof node.recommendedMaterial === 'object'
        ? {
            materialId: (node.recommendedMaterial.materialId && typeof node.recommendedMaterial.materialId === 'string' && /^[0-9a-fA-F]{24}$/.test(node.recommendedMaterial.materialId.trim())) ? node.recommendedMaterial.materialId.trim() : undefined,
            fileName: node.recommendedMaterial.fileName ? node.recommendedMaterial.fileName.trim() : undefined,
            excerpt: node.recommendedMaterial.excerpt ? node.recommendedMaterial.excerpt.trim() : undefined,
            pageNumber: typeof node.recommendedMaterial.pageNumber === 'number' ? node.recommendedMaterial.pageNumber : undefined
          }
        : undefined,
      practiceActivity: node.practiceActivity && typeof node.practiceActivity === 'object'
        ? {
            title: node.practiceActivity.title ? node.practiceActivity.title.trim() : 'Practice Exercise',
            description: node.practiceActivity.description ? node.practiceActivity.description.trim() : 'Solve targeted concept problems.',
            activityType: node.practiceActivity.activityType ? node.practiceActivity.activityType.trim() : 'practice_exercise'
          }
        : {
            title: `Practice: ${node.targetConcept || 'Target Concept'}`,
            description: 'Work through targeted concept practice problems.',
            activityType: 'practice_exercise'
          },
      difficulty,
      expectedOutcome: node.expectedOutcome ? node.expectedOutcome.trim() : '',
      reassessmentCriteria: node.reassessmentCriteria ? node.reassessmentCriteria.trim() : ''
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
    sanitizedLearningPath: {
      title: title.trim(),
      nodes: sanitizedNodes
    }
  };
};
