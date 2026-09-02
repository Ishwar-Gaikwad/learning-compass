export const buildAssessmentPrompt = ({
  topicTitle,
  contextData,
  totalQuestions = 5,
  difficulty = 'medium',
  questionTypes = ['mcq', 'short_answer'],
  additionalInstructions
}) => {
  const systemPrompt = `You are an expert AI pedagogical assessment generator for Learning Compass.
Your task is to generate a grounded, diagnostic assessment for students based STRICTLY on the provided course material context.

CRITICAL CONSTRAINTS & GROUNDING RULES:
1. Do NOT invent, hallucinate, or assume facts not supported by the provided learning material context.
2. Every question MUST be directly grounded in the provided source material chunks.
3. Every question MUST cite its source reference including materialId, pageNumber, and chunkIndex from the citation header.
4. Output MUST be valid, structured JSON adhering strictly to the required schema. No Markdown wrapping codeblocks outside JSON.
5. PEDAGOGICAL SUBJECT-MATTER FOCUS (MANDATORY):
   - Every generated question MUST strictly test student mastery of the educational subject matter/topic (e.g., "${topicTitle}", mathematical principles, formulas, definitions, and problem-solving).
   - RAG context is evidence and subject domain content, NOT the subject of student assessment.
   - NEVER generate questions about OCR, PDF extraction, document processing, scanned documents, RAG, vector chunks, citations, or file processing metadata.
   - Do NOT include terms like "OCR extracted text", "scanned document", "source material", "chunk", "RAG", or "citation" in student-facing question text or options.
   - Every question must be fully answerable using the educational content retrieved for the requested topic.
   - Preserve 'sourceReferences' internally in the JSON structure for teacher traceability without exposing meta-references in student-facing question text or options.`;

  const userPrompt = `Generate a diagnostic assessment for the educational topic "${topicTitle}".

ASSESSMENT CONFIGURATION:
- Topic / Subject Area: ${topicTitle}
- Total Questions: ${totalQuestions}
- Target Difficulty: ${difficulty}
- Allowed Question Types: ${questionTypes.join(', ')}
${additionalInstructions ? `- Additional Teacher Instructions: ${additionalInstructions}` : ''}

IMPORTANT PEDAGOGICAL DIRECTIVE:
All questions MUST test student understanding of "${topicTitle}" concepts and educational principles.
Do NOT create meta-questions about document extraction, OCR, scanning, RAG chunks, or source file metadata.

RETRIEVED COURSE MATERIAL CONTEXT:
${contextData.formattedContext}

REQUIRED JSON OUTPUT SCHEMA:
{
  "title": "${topicTitle} Diagnostic Assessment",
  "difficulty": "${difficulty}",
  "totalQuestions": ${totalQuestions},
  "questions": [
    {
      "questionText": "Question string directly grounded in course context",
      "questionType": "mcq | short_answer | code",
      "options": ["Option A", "Option B", "Option C", "Option D"], // Required for mcq, empty [] for short_answer
      "correctAnswer": "Correct answer string",
      "difficulty": "easy | medium | hard",
      "expectedConcepts": ["Concept 1", "Concept 2"],
      "rubric": {
        "gradingCriteria": "Detailed criteria for evaluating student answer",
        "sampleAnswer": "Model student answer string",
        "maxPoints": 1
      },
      "sourceReferences": [
        {
          "materialId": "source_material_objectId_string",
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
