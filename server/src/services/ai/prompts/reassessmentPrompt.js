export const buildReassessmentPrompt = ({
  report,
  learningPath,
  remediatedConcepts = [],
  originalQuestions = [],
  RAGContext,
  totalQuestions = 3,
  difficulty = 'medium'
}) => {
  const systemPrompt = `You are an expert AI educational assessment designer for Learning Compass.
Your task is to construct a targeted reassessment for a student who has completed personalized remediation activities based on an initial diagnostic report.

TARGETED REASSESSMENT DESIGN RULES:
1. TARGET REMEDIATED CONCEPTS: Every question MUST directly test one of the student's previously diagnosed weak concepts that were targeted and completed during remediation: ${remediatedConcepts.join(', ')}.
2. ADDRESS DIAGNOSED MISCONCEPTIONS: Questions should evaluate whether the student has genuinely overcome their specifically diagnosed misconceptions and dimensional gaps (conceptual, procedural, or application).
3. AVOID QUESTION LEAKAGE & DUPLICATION:
   - DO NOT copy the original assessment questions listed below.
   - DO NOT merely change numbers in the original questions.
   - Use a completely different problem scenario, context, or question formulation to verify true concept mastery rather than pattern memorization.
4. GROUND IN COURSE MATERIAL: Ground question content in the provided RAG course material context. Include 'sourceReferences' matching actual source materials when relevant context exists.
5. REQUIRED FIELDS PER QUESTION:
   - questionText: Fresh, clear problem text
   - questionType: 'mcq' | 'short_answer' | 'code'
   - options: Array of option strings for MCQ (at least 4 options if MCQ, empty array if short_answer)
   - correctAnswer: Complete correct answer string
   - difficulty: 'easy' | 'medium' | 'hard'
   - expectedConcepts: Array containing exact target concept name
   - rubric: { gradingCriteria: string, sampleAnswer: string, maxPoints: number }
   - sourceReferences: Array of { materialId, pageNumber, chunkIndex } matching supplied RAG context
6. PEDAGOGICAL SUBJECT-MATTER FOCUS: Every question MUST test the educational subject matter/concepts. Never generate questions or options about OCR, PDF extraction, document processing, scanned documents, RAG, vector chunks, citations, or file metadata.
7. Output MUST be valid, structured JSON matching the requested schema.`;

  const dimScores = report.dimensionScores || {};
  const formattedDimScores = `
- Conceptual Understanding: ${dimScores.conceptualUnderstanding?.score ?? 'N/A'} / 100 (${dimScores.conceptualUnderstanding?.masteryLevel ?? 'N/A'})
- Procedural Fluency: ${dimScores.proceduralFluency?.score ?? 'N/A'} / 100 (${dimScores.proceduralFluency?.masteryLevel ?? 'N/A'})
- Application & Transfer: ${dimScores.applicationAndTransfer?.score ?? 'N/A'} / 100 (${dimScores.applicationAndTransfer?.masteryLevel ?? 'N/A'})`;

  const formattedWeakConcepts = (report.weakConcepts || []).map((w, i) => `${i + 1}. Concept: "${w.concept}" (Severity: ${w.severity || 'medium'}) | Evidence: "${w.evidence || ''}"`).join('\n');
  const formattedMisconceptions = (report.identifiedMisconceptions || []).map((m, i) => `${i + 1}. Code: ${m.misconceptionCode || m.tag || 'MISCONCEPT'} | Title: "${m.title}" | Explanation: "${m.explanation || m.description || ''}"`).join('\n');
  
  const completedNodes = (learningPath?.nodes || []).filter((n) => n.isCompleted);
  const formattedRemediation = completedNodes.map((n, i) => `${i + 1}. Node: "${n.title}" | Target Concept: "${n.targetConcept}" | Objective: "${n.learningObjective}" | Activity: "${n.practiceActivity?.title || ''}"`).join('\n');

  const formattedOriginalQuestions = originalQuestions.map((q, i) => `Question #${i + 1}: "${typeof q === 'string' ? q : q.questionText || ''}"`).join('\n');

  const userPrompt = `TARGETED REASSESSMENT TASK: Design a ${totalQuestions}-question targeted reassessment to evaluate student concept recovery.

STUDENT ORIGINAL DIAGNOSTIC PROFILE:
- Overall Mastery Score: ${report.overallMasteryScore || 0} / 100 (${report.masteryLevel || 'developing'})
- Diagnostic Summary: "${report.aiSummary || ''}"

DIMENSIONAL MASTERY BREAKDOWN:
${formattedDimScores}

PREVIOUSLY DIAGNOSED WEAK CONCEPTS:
${formattedWeakConcepts || 'None explicitly listed.'}

DIAGNOSED MISCONCEPTIONS:
${formattedMisconceptions || 'None explicitly tagged.'}

COMPLETED REMEDIATION ACTIVITIES:
${formattedRemediation || 'Student completed assigned remediation activities for diagnosed weak concepts.'}

ORIGINAL ASSESSMENT QUESTIONS (DO NOT COPY OR REPEAT):
${formattedOriginalQuestions || 'No original question text available.'}

RETRIEVED TEACHER COURSE MATERIAL CONTEXT (RAG Grounding):
${RAGContext?.formattedContext || 'No specific course material context retrieved.'}

REQUIRED JSON OUTPUT SCHEMA:
{
  "title": "Targeted Reassessment for Topic",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "questionText": "Fresh, distinct problem text testing conceptual recovery",
      "questionType": "mcq | short_answer | code",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact correct answer text",
      "difficulty": "medium",
      "expectedConcepts": ["Target Weak Concept Name"],
      "rubric": {
        "gradingCriteria": "Specific criteria testing recovery of weak concept",
        "sampleAnswer": "Sample correct answer explanation",
        "maxPoints": 1
      },
      "sourceReferences": [
        {
          "materialId": "material_objectId_string",
          "pageNumber": 1,
          "chunkIndex": 0
        }
      ]
    }
  ]
}`;

  return {
    systemPrompt,
    userPrompt
  };
};
