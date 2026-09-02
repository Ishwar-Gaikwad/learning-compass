import { Attempt } from '../models/Attempt.js';
import { AttemptResponse } from '../models/AttemptResponse.js';
import { Assessment } from '../models/Assessment.js';
import { ragRetrievalService } from './rag/ragRetrievalService.js';
import { llmService } from './ai/llmService.js';
import { buildEvaluationPrompt } from './ai/prompts/evaluationPrompt.js';
import { validateEvaluationOutput } from '../utils/validators/evaluation.validator.js';
import { AppError } from '../utils/AppError.js';

export const evaluationService = {
  async evaluateResponse({ attemptId, responseId, userId, userRole, options = {} }) {
    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Security check: Student cannot evaluate another student's response
    if (userRole === 'student' && attempt.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot evaluate another student\'s response.', 403, 'FORBIDDEN');
    }

    // Attempt submission constraint: Only submitted or active evaluation attempts can be evaluated
    const validStatuses = ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'];
    if (!validStatuses.includes(attempt.status)) {
      throw new AppError('Cannot evaluate an unsubmitted assessment attempt. Please submit the attempt first.', 400, 'ATTEMPT_NOT_SUBMITTED');
    }

    const responseDoc = await AttemptResponse.findOne({ _id: responseId, attemptId });

    if (!responseDoc) {
      throw new AppError('Response record not found for this attempt session.', 404, 'RESPONSE_NOT_FOUND');
    }

    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) {
      throw new AppError('Parent assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    const question = assessment.questions.find((q) => q._id.toString() === responseDoc.questionId.toString());
    if (!question) {
      throw new AppError('Associated question schema not found on assessment.', 400, 'QUESTION_NOT_FOUND');
    }

    const maxPoints = question.rubric?.maxPoints || 1;

    if (responseDoc.evaluation && responseDoc.evaluation.correctness) {
      console.log(`[EVALUATION] Reusing existing evaluation for responseId: ${responseDoc._id}`);
      return responseDoc;
    }

    // RAG Context Retrieval for concept evaluation
    let contextData = null;
    try {
      const retrievalResult = await ragRetrievalService.retrieveRelevantChunks({
        query: question.questionText,
        teacherId: assessment.teacherId,
        courseId: assessment.courseId,
        topicId: assessment.topicId,
        topK: 3
      });
      contextData = retrievalResult.context;
    } catch (ragErr) {
      console.warn(`[EVALUATION] RAG retrieval skipped/failed for Q:${question._id}:`, ragErr.message);
    }

    // Build evaluation prompt with RAG context
    const prompts = buildEvaluationPrompt({
      question,
      expectedConcepts: question.expectedConcepts || [],
      rubric: question.rubric,
      studentResponse: responseDoc.studentAnswer,
      contextData
    });

    let rawLLMOutput;
    try {
      rawLLMOutput = await llmService.generateStructuredJSON({
        prompt: prompts.userPrompt,
        systemPrompt: prompts.systemPrompt,
        temperature: 0.1,
        options
      });
    } catch (err) {
      throw new AppError(`AI evaluation service invocation failed: ${err.message}`, 400, 'EVALUATION_FAILED');
    }

    // Validate structured AI output (Never store malformed output!)
    let validationResult = validateEvaluationOutput(rawLLMOutput, maxPoints);

    if (!validationResult.isValid && !options.skipRetry) {
      try {
        rawLLMOutput = await llmService.generateStructuredJSON({
          prompt: `${prompts.userPrompt}\n\nWARNING: Previous output failed schema validation with errors:\n${validationResult.errors.join('\n')}\nPlease fix all schema errors.`,
          systemPrompt: prompts.systemPrompt,
          temperature: 0.0,
          options
        });
        validationResult = validateEvaluationOutput(rawLLMOutput, maxPoints);
      } catch (retryErr) {
        throw new AppError(`AI evaluation retry failed: ${retryErr.message}`, 400, 'EVALUATION_FAILED');
      }
    }

    if (!validationResult.isValid) {
      throw new AppError(
        `AI evaluation failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    const sanitizedEvaluation = validationResult.sanitizedEvaluation;

    // Update Response entity with evaluation results
    responseDoc.evaluation = sanitizedEvaluation;
    responseDoc.isCorrect = (sanitizedEvaluation.correctness === 'correct');
    responseDoc.scoreGiven = sanitizedEvaluation.score;
    await responseDoc.save();

    return {
      response: responseDoc,
      evaluation: sanitizedEvaluation
    };
  },

  async evaluateAttempt({ attemptId, userId, userRole, options = {} }) {
    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (userRole === 'student' && attempt.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot evaluate another student\'s attempt.', 403, 'FORBIDDEN');
    }

    const validStatuses = ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'];
    if (!validStatuses.includes(attempt.status)) {
      throw new AppError('Cannot evaluate an unsubmitted assessment attempt. Please submit the attempt first.', 400, 'ATTEMPT_NOT_SUBMITTED');
    }

    console.log(`[EVALUATION] started for attemptId: ${attempt._id}`);

    if (attempt.status === 'submitted') {
      attempt.status = 'evaluating';
      await attempt.save();
    }

    const responses = await AttemptResponse.find({ attemptId: attempt._id });

    if (!responses || responses.length === 0) {
      throw new AppError('No responses submitted for this attempt session to evaluate.', 400, 'NO_RESPONSES_FOUND');
    }

    console.log(`[EVALUATION] response processing started for attemptId: ${attempt._id}`);

    const evaluationResults = [];
    let totalScore = 0;
    let totalMaxScore = 0;

    for (const resDoc of responses) {
      const evalRes = await this.evaluateResponse({
        attemptId: attempt._id,
        responseId: resDoc._id,
        userId,
        userRole,
        options
      });
      evaluationResults.push(evalRes);
      totalScore += evalRes.evaluation.score;
      totalMaxScore += evalRes.evaluation.maxScore;
    }

    console.log(`[EVALUATION] response processing completed for attemptId: ${attempt._id}`);

    attempt.status = 'evaluated';
    attempt.score = totalScore;
    attempt.maxScore = totalMaxScore;
    attempt.percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    await attempt.save();

    return {
      attempt,
      evaluatedResponsesCount: evaluationResults.length,
      responses: evaluationResults.map((r) => r.response)
    };
  }
};
