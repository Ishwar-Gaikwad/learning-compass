import { Attempt } from '../models/Attempt.js';
import { AttemptResponse } from '../models/AttemptResponse.js';
import { Assessment } from '../models/Assessment.js';
import { Topic } from '../models/Topic.js';
import { Course } from '../models/Course.js';
import { DiagnosticReport } from '../models/DiagnosticReport.js';
import { LearningPath } from '../models/LearningPath.js';
import { evaluationService } from './evaluation.service.js';
import { learningPathService } from './learningPath.service.js';
import { ragRetrievalService } from './rag/ragRetrievalService.js';
import { llmService } from './ai/llmService.js';
import { buildDiagnosticPrompt } from './ai/prompts/diagnosticPrompt.js';
import { validateDiagnosticOutput } from '../utils/validators/diagnostic.validator.js';
import { AppError } from '../utils/AppError.js';

export const diagnosticService = {
  async generateDiagnosticReport({ attemptId, userId, userRole, options = {} }) {
    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Security check: Student cannot generate/access another student's report
    if (userRole === 'student' && attempt.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s diagnostic report.', 403, 'FORBIDDEN');
    }

    // Attempt submission constraint: Only submitted/evaluated attempts can be diagnosed
    if (attempt.status === 'in_progress') {
      throw new AppError('Cannot generate a diagnostic report from an unsubmitted assessment attempt. Please submit the attempt first.', 400, 'ATTEMPT_NOT_SUBMITTED');
    }

    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) {
      throw new AppError('Parent assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    // Teacher authorization check if invoked by a teacher
    if (userRole === 'teacher' && assessment.teacherId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You do not own this course assessment.', 403, 'FORBIDDEN');
    }

    const topic = await Topic.findById(assessment.topicId);
    let responses = await AttemptResponse.find({ attemptId: attempt._id });

    if (!responses || responses.length === 0) {
      throw new AppError('No student responses found for this attempt to evaluate.', 400, 'NO_RESPONSES_FOUND');
    }

    // Ensure all responses are evaluated before running diagnostic pattern analysis
    const unevaluated = responses.some((r) => !r.evaluation || !r.evaluation.correctness);
    if (unevaluated) {
      await evaluationService.evaluateAttempt({ attemptId: attempt._id, userId, userRole, options });
      responses = await AttemptResponse.find({ attemptId: attempt._id });
    }

    console.log(`[DIAGNOSTIC] generation started for attemptId: ${attempt._id}`);

    await Attempt.findByIdAndUpdate(attempt._id, { status: 'generating_diagnostic' });

    // Concept & Misconception Aggregation Logic
    const conceptMasteryMap = {};
    const missingConceptsSet = new Set();
    const misconceptionTagsSet = new Set();
    const evidenceMap = [];

    responses.forEach((resDoc) => {
      const evalData = resDoc.evaluation || {};
      
      (evalData.identifiedConcepts || []).forEach((concept) => {
        conceptMasteryMap[concept] = (conceptMasteryMap[concept] || 0) + 1;
      });

      (evalData.missingConcepts || []).forEach((concept) => {
        missingConceptsSet.add(concept);
      });

      (evalData.misconceptions || []).forEach((m) => {
        if (m.tag) misconceptionTagsSet.add(m.tag);
      });

      evidenceMap.push({
        questionId: resDoc.questionId,
        responseId: resDoc._id,
        studentAnswer: resDoc.studentAnswer,
        correctness: evalData.correctness,
        score: evalData.score,
        reasoning: evalData.reasoning,
        misconceptions: evalData.misconceptions || []
      });
    });

    const aggregationData = {
      masteredConcepts: Object.keys(conceptMasteryMap),
      deficientConcepts: Array.from(missingConceptsSet),
      misconceptionTags: Array.from(misconceptionTagsSet)
    };

    // RAG Context Retrieval for topic diagnostic synthesis
    let contextData = null;
    try {
      const retrievalResult = await ragRetrievalService.retrieveRelevantChunks({
        query: topic?.title || 'Topic Diagnostic',
        teacherId: assessment.teacherId,
        courseId: assessment.courseId,
        topicId: assessment.topicId,
        topK: 5
      });
      contextData = retrievalResult.context;
      console.log(`[DIAGNOSTIC] RAG retrieval completed. Chunks count: ${retrievalResult.chunksCount}, Model: ${llmService.getModelName()}`);
    } catch (ragErr) {
      console.warn(`[DIAGNOSTIC] RAG retrieval skipped/failed for topic:${assessment.topicId}:`, ragErr.message);
    }

    // Construct diagnostic prompts for AI pattern analysis
    const prompts = buildDiagnosticPrompt({
      attempt,
      assessment,
      topic,
      evaluatedResponses: responses,
      aggregationData,
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
      throw new AppError(`AI diagnostic engine service invocation failed: ${err.message}`, 400, 'DIAGNOSTIC_FAILED');
    }

    // Validate structured AI output (Never store malformed output!)
    let validationResult = validateDiagnosticOutput(rawLLMOutput);

    if (!validationResult.isValid && !options.skipRetry) {
      try {
        rawLLMOutput = await llmService.generateStructuredJSON({
          prompt: `${prompts.userPrompt}\n\nWARNING: Previous output failed schema validation with errors:\n${validationResult.errors.join('\n')}\nPlease fix all schema errors.`,
          systemPrompt: prompts.systemPrompt,
          temperature: 0.0,
          options
        });
        validationResult = validateDiagnosticOutput(rawLLMOutput);
      } catch (retryErr) {
        throw new AppError(`AI diagnostic retry failed: ${retryErr.message}`, 400, 'DIAGNOSTIC_FAILED');
      }
    }

    if (!validationResult.isValid) {
      throw new AppError(
        `AI diagnostic report generation failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    const sanitizedReport = validationResult.sanitizedReport;
    const defaultResponseId = responses[0] ? responses[0]._id : undefined;
    const defaultQuestionId = responses[0] ? responses[0].questionId : undefined;

    // Attach evidence-traceability references to diagnostic findings
    sanitizedReport.strengths = sanitizedReport.strengths.map((s, idx) => ({
      ...s,
      questionId: s.questionId || (responses[idx % responses.length]?.questionId || defaultQuestionId),
      responseId: s.responseId || (responses[idx % responses.length]?._id || defaultResponseId)
    }));

    sanitizedReport.weakConcepts = sanitizedReport.weakConcepts.map((w, idx) => ({
      ...w,
      questionId: w.questionId || (responses[idx % responses.length]?.questionId || defaultQuestionId),
      responseId: w.responseId || (responses[idx % responses.length]?._id || defaultResponseId)
    }));

    sanitizedReport.identifiedMisconceptions = sanitizedReport.identifiedMisconceptions.map((m, idx) => ({
      ...m,
      evidenceQuestions: m.evidenceQuestions?.length > 0 ? m.evidenceQuestions : [responses[idx % responses.length]?.questionId || defaultQuestionId],
      responseId: m.responseId || (responses[idx % responses.length]?._id || defaultResponseId)
    }));

    // Upsert DiagnosticReport document in MongoDB Atlas
    const reportDoc = await DiagnosticReport.findOneAndUpdate(
      { attemptId: attempt._id },
      {
        attemptId: attempt._id,
        assessmentId: assessment._id,
        studentId: attempt.studentId,
        topicId: assessment.topicId,
        teacherId: assessment.teacherId,
        overallMasteryScore: sanitizedReport.overallMasteryScore,
        masteryLevel: sanitizedReport.masteryLevel,
        dimensionScores: sanitizedReport.dimensionScores,
        strengths: sanitizedReport.strengths,
        weakConcepts: sanitizedReport.weakConcepts,
        proceduralWeaknesses: sanitizedReport.proceduralWeaknesses,
        applicationWeaknesses: sanitizedReport.applicationWeaknesses,
        identifiedMisconceptions: sanitizedReport.identifiedMisconceptions,
        recommendations: sanitizedReport.recommendations,
        aiSummary: sanitizedReport.aiSummary
      },
      { upsert: true, new: true, runValidators: true }
    );

    await Attempt.findByIdAndUpdate(attempt._id, { status: 'evaluated' });

    console.log(`[DIAGNOSTIC] generation completed for attemptId: ${attempt._id}`);

    // Automatically trigger Learning Path generation ONLY for initial_diagnostic assessments
    let learningPathDoc = null;
    if (assessment.type !== 'reassessment') {
      try {
        console.log(`[LEARNING_PATH] generation requested for diagnosticId: ${reportDoc._id}, studentId: ${attempt.studentId}`);
        const lpResult = await learningPathService.generateLearningPath({
          diagnosticReportId: reportDoc._id,
          userId: attempt.studentId,
          userRole: 'student',
          options
        });
        learningPathDoc = lpResult.learningPath;
      } catch (lpErr) {
        console.error(`[LEARNING_PATH] generation failed for diagnosticId: ${reportDoc._id}:`, lpErr.message);
      }
    } else {
      console.log(`[DIAGNOSTIC] skipping new learning path creation for reassessment attemptId: ${attempt._id}`);
      try {
        const parentPath = await LearningPath.findOne({
          $or: [
            { diagnosticReportId: assessment.previousDiagnosticReportId },
            { _id: assessment.learningPathId }
          ]
        });
        if (parentPath) {
          parentPath.status = 'completed';
          parentPath.overallProgressPercentage = 100;
          await parentPath.save();
          console.log(`[DIAGNOSTIC] Marked LearningPath ${parentPath._id} as completed after reassessment diagnostic report generation.`);
        }
      } catch (lpErr) {
        console.error(`[DIAGNOSTIC] Failed to update parent learning path status:`, lpErr.message);
      }
    }

    return {
      report: reportDoc,
      learningPath: learningPathDoc,
      evaluatedResponsesCount: responses.length
    };
  },

  async getDiagnosticReport({ attemptId, userId, userRole }) {
    const report = await DiagnosticReport.findOne({ attemptId })
      .populate('assessmentId', 'title difficulty')
      .populate('topicId', 'title order')
      .populate('studentId', 'name email');

    if (!report) {
      throw new AppError('Diagnostic report not found for this assessment attempt.', 404, 'REPORT_NOT_FOUND');
    }

    // Security check: Student can only view their own report
    if (userRole === 'student' && report.studentId._id.toString() !== userId.toString() && report.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s diagnostic report.', 403, 'FORBIDDEN');
    }

    // Security check: Teacher can only view reports for courses they own
    if (userRole === 'teacher' && report.teacherId.toString() !== userId.toString()) {
      const course = await Course.findOne({ teacherId: userId });
      if (!course) {
        throw new AppError('Access denied. You do not own this course or student diagnostic report.', 403, 'FORBIDDEN');
      }
    }

    return report;
  }
};
