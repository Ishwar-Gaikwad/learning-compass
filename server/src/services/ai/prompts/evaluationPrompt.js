export const buildEvaluationPrompt = ({ question, expectedConcepts, rubric, studentResponse, contextData }) => {
  const systemPrompt = `You are an expert AI pedagogical evaluator for Learning Compass.
Your task is to evaluate a student's answer to an assessment question objectively using genuine evidence-based AI reasoning and construct a diagnostic evaluation payload.

CRITICAL EVALUATION & EVIDENCE RULES:
1. Do NOT use simplistic heuristics such as response length, keyword presence ("because"), or fixed scores.
2. Compare the student's actual response against:
   - Question prompt & options/correct answer
   - Expected concepts & grading rubric
   - Relevant learning material context provided below.
3. Distinguish carefully between:
   - Correct answer with correct reasoning (High conceptual & procedural scores)
   - Correct answer with weak/incorrect reasoning (Lower conceptual score, identified misconception)
   - Incorrect answer with partially correct reasoning (Partial score, specific missing concept)
   - Incorrect answer caused by conceptual misunderstanding vs procedural/calculation error
   - Incomplete or empty response (0 score, missing concepts, explicit insufficient evidence)
4. Evaluate 3 core diagnostic dimensions on a normalized scale from 0.0 to 1.0:
   - conceptualUnderstanding: Understanding of underlying theoretical concepts (0.0 to 1.0)
   - proceduralFluency: Execution of mathematical, logical, or algorithmic steps (0.0 to 1.0)
   - applicationTransfer: Ability to apply concepts to problem context (0.0 to 1.0)
5. Identify mastered concepts in identifiedConcepts, missing concepts in missingConcepts, and specific misconceptions in misconceptions array.
6. Provide concrete evidence quotes/rationale in reasoning.
7. Output MUST be valid, structured JSON matching the requested schema exactly.`;

  const formattedRAG = contextData?.formattedContext
    ? `\nRELEVANT LEARNING MATERIAL CONTEXT:\n${contextData.formattedContext}\n`
    : '';

  const userPrompt = `EVALUATION TASK: Evaluate the student response below.
${formattedRAG}
QUESTION PROMPT:
${question.questionText}
Question Type: ${question.questionType}
Difficulty: ${question.difficulty || 'medium'}
${question.options && question.options.length > 0 ? `Options: ${question.options.join(', ')}\nCorrect Answer: ${question.correctAnswer}` : `Expected Answer: ${question.correctAnswer}`}

EXPECTED CONCEPTS:
${Array.isArray(expectedConcepts) ? expectedConcepts.join(', ') : 'N/A'}

GRADING RUBRIC:
- Grading Criteria: ${rubric?.gradingCriteria || 'Evaluates accuracy and conceptual mastery.'}
- Sample Answer: ${rubric?.sampleAnswer || question.correctAnswer}
- Max Points: ${rubric?.maxPoints || 1}

STUDENT RESPONSE:
"${studentResponse || ''}"

REQUIRED JSON OUTPUT SCHEMA:
{
  "correctness": "correct | partially_correct | incorrect",
  "score": 1, // Number between 0 and ${rubric?.maxPoints || 1}
  "conceptualUnderstanding": 0.95, // Number between 0.0 and 1.0
  "proceduralFluency": 0.90, // Number between 0.0 and 1.0
  "applicationTransfer": 0.85, // Number between 0.0 and 1.0
  "identifiedConcepts": ["Concept 1", "Concept 2"],
  "missingConcepts": ["Missing Concept 1"],
  "misconceptions": [
    {
      "tag": "MISCONCEPTION_TAG",
      "description": "Clear explanation of the misconception"
    }
  ],
  "reasoning": "Detailed justification and evidence quote for the evaluation score."
}`;

  return {
    systemPrompt,
    userPrompt
  };
};
