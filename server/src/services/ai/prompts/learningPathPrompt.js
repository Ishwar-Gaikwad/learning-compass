export const buildLearningPathPrompt = ({
  report,
  targetConcepts,
  misconceptions,
  RAGContext
}) => {
  const systemPrompt = `You are an expert AI personalized learning path designer for Learning Compass.
Your task is to construct a targeted, sequential remediation learning path for a student based strictly on their diagnostic report findings and retrieved learning material context.

PERSONALIZATION & LEARNING PATH DESIGN RULES:
1. Address diagnosed misconceptions and fundamental conceptual gaps FIRST.
2. Prioritize activities according to dimensional mastery:
   - If Conceptual Understanding score is low/developing: Include 'concept_explanation' or 'remedial_reading' modules targeting foundational principles.
   - If Procedural Fluency score is low/developing: Include 'practice_exercise' modules with step-by-step problem-solving practice.
   - If Application/Transfer score is low/developing: Include multi-step or real-world application tasks and 'checkpoint_quiz' modules.
3. Sequence nodes logically from easier tasks to harder tasks ('easy' -> 'medium' -> 'hard').
4. AVOID assigning unnecessary tasks for concepts already demonstrated as mastered in the student's strengths.
5. GROUND recommendations in the supplied RAG course material context. Include 'recommendedMaterial' matching actual source materials when relevant context exists.
6. Provide specific, actionable exercise descriptions. DO NOT create generic placeholders like "Practice the topic" or "Study more". Each activity must detail specific step-by-step student instructions.
7. Prepare the student directly for a targeted reassessment.
8. Output MUST be valid, structured JSON matching the requested schema.`;

  const dimScores = report.dimensionScores || {};
  const formattedDimScores = `
- Conceptual Understanding: ${dimScores.conceptualUnderstanding?.score ?? 'N/A'} / 100 (${dimScores.conceptualUnderstanding?.masteryLevel ?? 'N/A'})
- Procedural Fluency: ${dimScores.proceduralFluency?.score ?? 'N/A'} / 100 (${dimScores.proceduralFluency?.masteryLevel ?? 'N/A'})
- Application & Transfer: ${dimScores.applicationAndTransfer?.score ?? 'N/A'} / 100 (${dimScores.applicationAndTransfer?.masteryLevel ?? 'N/A'})`;

  const formattedStrengths = (report.strengths || []).map((s, i) => `${i + 1}. Concept: "${s.concept}" | Evidence: "${s.evidence || s.reasoning || ''}"`).join('\n');
  const formattedWeakConcepts = (targetConcepts || report.weakConcepts || []).map((w, i) => `${i + 1}. Concept: "${w.concept}" (Severity: ${w.severity || 'medium'}) | Evidence: "${w.evidence || 'Diagnosed concept deficiency'}"`).join('\n');
  const formattedProcedural = (report.proceduralWeaknesses || []).map((p, i) => `${i + 1}. Skill: "${p.skill}" | Issue: "${p.issue || ''}"`).join('\n');
  const formattedApplication = (report.applicationWeaknesses || []).map((a, i) => `${i + 1}. Context: "${a.context}" | Gap: "${a.gap || ''}"`).join('\n');
  const formattedMisconceptions = (misconceptions || report.identifiedMisconceptions || []).map((m, i) => `${i + 1}. Code: ${m.misconceptionCode || m.tag || 'MISCONCEPT'} | Title: "${m.title}" | Explanation: "${m.explanation}"`).join('\n');
  const formattedRecommendations = (report.recommendations || []).map((r, i) => `${i + 1}. Recommendation: "${r.recommendation}" | Type: ${r.type || 'conceptual'}`).join('\n');

  const userPrompt = `LEARNING PATH TASK: Design a personalized remediation pathway based on student diagnostic evidence.

STUDENT OVERALL MASTERY DIAGNOSIS:
- Overall Mastery Score: ${report.overallMasteryScore || 0} / 100
- Mastery Level: ${report.masteryLevel || 'developing'}
- AI Diagnostic Summary: "${report.aiSummary || 'Student requires targeted concept remediation.'}"

DIMENSIONAL MASTERY BREAKDOWN:
${formattedDimScores}

DEMONSTRATED STRENGTHS (Do NOT re-teach these):
${formattedStrengths || 'None explicitly identified.'}

TARGET WEAK CONCEPTS:
${formattedWeakConcepts || 'None explicitly listed; target overall topic fundamentals.'}

PROCEDURAL WEAKNESSES:
${formattedProcedural || 'None explicitly tagged.'}

APPLICATION / TRANSFER WEAKNESSES:
${formattedApplication || 'None explicitly tagged.'}

DIAGNOSED MISCONCEPTIONS:
${formattedMisconceptions || 'None explicitly tagged.'}

DIAGNOSTIC RECOMMENDATIONS:
${formattedRecommendations || 'Target concept fundamentals.'}

RETRIEVED TEACHER COURSE MATERIAL CONTEXT (RAG Grounding):
${RAGContext?.formattedContext || 'No specific course material context retrieved.'}

REQUIRED JSON OUTPUT SCHEMA:
{
  "title": "Personalized Remediation Pathway for Topic",
  "nodes": [
    {
      "nodeId": "node_1_concept_name",
      "sequenceOrder": 1,
      "title": "Remedial Module Title",
      "type": "remedial_reading | practice_exercise | concept_explanation | checkpoint_quiz",
      "targetConcept": "Exact Name of Target Weak Concept",
      "reasonForTargeting": "Specific diagnostic evidence explaining why this concept is targeted",
      "learningObjective": "Clear pedagogical learning objective",
      "recommendedMaterial": {
        "materialId": "material_objectId_string",
        "fileName": "source_filename.pdf",
        "excerpt": "Specific relevant text excerpt from RAG context",
        "pageNumber": 1
      },
      "practiceActivity": {
        "title": "Practice Activity Title",
        "description": "Clear step-by-step instructions for student practice exercise",
        "activityType": "practice_exercise"
      },
      "difficulty": "easy | medium | hard",
      "expectedOutcome": "Concrete measurable outcome upon completion",
      "reassessmentCriteria": "Specific criteria to prove readiness for reassessment"
    }
  ]
}`;

  return {
    systemPrompt,
    userPrompt
  };
};

