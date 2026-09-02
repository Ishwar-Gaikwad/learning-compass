export const buildDiagnosticPrompt = ({
  attempt,
  assessment,
  topic,
  evaluatedResponses,
  aggregationData,
  contextData
}) => {
  const systemPrompt = `You are an expert AI diagnostic analysis engine for Learning Compass.
Your task is to analyze a student's evaluated assessment responses for topic "${topic?.title || 'Course Topic'}" against relevant learning material context and synthesize a rigorous, evidence-based diagnostic report.

DIAGNOSTIC ANALYSIS & EVIDENCE RULES:
1. Do NOT use simplistic heuristics (response length, keyword templates, or fixed scores).
2. Ground all diagnostic findings in both:
   - The student's actual evaluated responses
   - The provided learning material context
3. Analyze performance across 3 core dimensions:
   - conceptualUnderstanding: Theoretical mastery of underlying concepts (0.0 to 1.0)
   - proceduralFluency: Accuracy in step-by-step mathematical/procedural calculations (0.0 to 1.0)
   - applicationTransfer: Ability to apply concepts to real problem contexts (0.0 to 1.0)
4. Distinguish carefully between:
   - Correct answer with correct reasoning
   - Correct answer with weak/incorrect reasoning
   - Incorrect answer with partial reasoning
   - Conceptual misunderstanding vs procedural/calculation error
   - Incomplete response or lack of evidence (explicitly state "insufficient evidence" when response is blank/vague).
5. EVERY diagnostic finding (strengths, weakConcepts, proceduralWeaknesses, applicationWeaknesses) MUST include a concrete evidence quote or observed step from student responses.
6. Avoid generic recommendations like "Student needs more practice". Provide specific, actionable learning steps based on identified concept gaps.
7. Output MUST be valid, structured JSON matching the requested schema exactly.`;

  const formattedRAG = contextData?.formattedContext
    ? `\nRELEVANT LEARNING MATERIAL CONTEXT:\n${contextData.formattedContext}\n`
    : '';

  const formattedResponses = evaluatedResponses.map((r, idx) => {
    const evalData = r.evaluation || {};
    return `[Response #${idx + 1} | Question ID: ${r.questionId} | Response ID: ${r._id}]
Student Answer: "${r.studentAnswer || ''}"
Correctness: ${evalData.correctness || (r.isCorrect ? 'correct' : 'incorrect')}
Score: ${evalData.score || 0} / ${evalData.maxScore || 1}
Dimension Scores: Conceptual = ${evalData.conceptualUnderstanding || 0}, Procedural = ${evalData.proceduralFluency || 0}, Application = ${evalData.applicationTransfer || 0}
Identified Concepts: ${Array.isArray(evalData.identifiedConcepts) ? evalData.identifiedConcepts.join(', ') : 'None'}
Missing Concepts: ${Array.isArray(evalData.missingConcepts) ? evalData.missingConcepts.join(', ') : 'None'}
Tagged Misconceptions: ${Array.isArray(evalData.misconceptions) ? evalData.misconceptions.map((m) => `${m.tag}: ${m.description}`).join('; ') : 'None'}
Evaluation Evidence & Rationale: "${evalData.reasoning || 'N/A'}"`;
  }).join('\n\n');

  const userPrompt = `DIAGNOSTIC ANALYSIS TASK: Synthesize diagnostic report for topic "${topic?.title || 'Topic'}".
${formattedRAG}
ASSESSMENT ATTEMPT SUMMARY:
- Total Attempt Score: ${attempt.score || 0} / ${attempt.maxScore || evaluatedResponses.length}
- Calculated Percentage: ${attempt.percentage || 0}%
- Total Evaluated Responses: ${evaluatedResponses.length}

CONCEPT AGGREGATION METRICS:
- Mastered Concepts: ${aggregationData.masteredConcepts.join(', ') || 'None'}
- Deficient Concepts: ${aggregationData.deficientConcepts.join(', ') || 'None'}
- Aggregated Misconception Codes: ${aggregationData.misconceptionTags.join(', ') || 'None'}

EVALUATED RESPONSES EVIDENCE DATA:
${formattedResponses}

REQUIRED JSON OUTPUT SCHEMA:
{
  "overallMasteryScore": 85, // Number 0-100
  "masteryLevel": "novice | developing | proficient | mastered",
  "dimensionScores": {
    "conceptualUnderstanding": 0.90, // Number 0.0-1.0
    "proceduralFluency": 0.85, // Number 0.0-1.0
    "applicationTransfer": 0.80 // Number 0.0-1.0
  },
  "strengths": [
    {
      "concept": "Concept Name",
      "evidence": "Specific evidence quote or rationale from student response"
    }
  ],
  "weakConcepts": [
    {
      "concept": "Concept Name",
      "severity": "low | medium | high",
      "evidence": "Specific evidence quote or rationale from student response"
    }
  ],
  "proceduralWeaknesses": [
    {
      "description": "Procedural step issue",
      "evidence": "Specific evidence quote or step from student response"
    }
  ],
  "applicationWeaknesses": [
    {
      "description": "Application gap description",
      "evidence": "Specific evidence quote from student response"
    }
  ],
  "identifiedMisconceptions": [
    {
      "misconceptionCode": "MISCONCEPTION_TAG",
      "title": "Title of misconception",
      "explanation": "Clear explanation of the misconception",
      "severity": "low | medium | high"
    }
  ],
  "recommendations": [
    "Targeted pedagogical recommendation 1",
    "Targeted pedagogical recommendation 2"
  ],
  "aiSummary": "Executive diagnostic summary of student performance and targeted growth areas."
}`;

  return {
    systemPrompt,
    userPrompt
  };
};
