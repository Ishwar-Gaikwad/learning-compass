import { DiagnosticReport } from '../models/DiagnosticReport.js';
import { DiagnosticComparison } from '../models/DiagnosticComparison.js';
import { LearningPath } from '../models/LearningPath.js';
import { Attempt } from '../models/Attempt.js';
import { AttemptResponse } from '../models/AttemptResponse.js';
import { Course } from '../models/Course.js';
import { llmService } from './ai/llmService.js';
import { buildImprovementPrompt } from './ai/prompts/improvementPrompt.js';
import { validateComparisonOutput } from '../utils/validators/comparison.validator.js';
import { AppError } from '../utils/AppError.js';

export const comparisonService = {
  async compareDiagnostics({ previousReportId, newReportId, reassessmentAttemptId, userId, userRole, options = {} }) {
    const previousReport = await DiagnosticReport.findById(previousReportId);
    const newReport = await DiagnosticReport.findById(newReportId);

    if (!previousReport || !newReport) {
      throw new AppError('One or both diagnostic reports could not be found for comparison.', 404, 'REPORT_NOT_FOUND');
    }

    // Security & authorization check
    if (userRole === 'student' && newReport.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s diagnostic comparison.', 403, 'FORBIDDEN');
    }

    if (userRole === 'teacher' && newReport.teacherId.toString() !== userId.toString()) {
      const course = await Course.findOne({ teacherId: userId });
      if (!course) {
        throw new AppError('Access denied. You do not own this course or student comparison.', 403, 'FORBIDDEN');
      }
    }

    // Step 9: Prerequisite State Checks
    const reassessmentAttempt = await Attempt.findById(reassessmentAttemptId);
    if (!reassessmentAttempt || reassessmentAttempt.status === 'in_progress') {
      throw new AppError('Cannot generate improvement analysis for an unsubmitted reassessment attempt.', 400, 'ATTEMPT_NOT_SUBMITTED');
    }

    const learningPath = await LearningPath.findOne({
      $or: [{ diagnosticReportId: previousReport._id }, { _id: previousReport.learningPathId }]
    });

    if (learningPath && Array.isArray(learningPath.nodes) && learningPath.nodes.length > 0) {
      const hasCompletedNodes = learningPath.nodes.some((n) => n.isCompleted);
      if (!hasCompletedNodes && !options.skipRemediationCheck) {
        throw new AppError('Remediation activities must be completed before improvement analysis can be generated.', 400, 'REMEDIATION_INCOMPLETE');
      }
    }

    // Step 10: Idempotency Check — Reuse existing comparison document if available
    const existingComparison = await DiagnosticComparison.findOne({ reassessmentAttemptId });
    if (existingComparison && !options.forceRecompare) {
      console.log(`[COMPARISON] Reusing existing comparison ID: ${existingComparison._id}`);
      return existingComparison;
    }

    // Step 3: Fetch Response Evidence from initial attempt and reassessment attempt
    const initialResponses = previousReport.attemptId
      ? await AttemptResponse.find({ attemptId: previousReport.attemptId }).populate('questionId', 'questionText expectedConcepts')
      : [];

    const reassessmentResponses = await AttemptResponse.find({ attemptId: reassessmentAttemptId }).populate('questionId', 'questionText expectedConcepts');

    // Step 6: Construct Dedicated Improvement Prompt
    const prompts = buildImprovementPrompt({
      previousReport,
      newReport,
      learningPath,
      initialResponses,
      reassessmentResponses
    });

    // Step 6 & 7: Invoke LLM Service for AI Improvement Analysis
    let rawLLMOutput = await llmService.generateStructuredJSON({
      prompt: prompts.userPrompt,
      systemPrompt: prompts.systemPrompt,
      temperature: 0.1,
      options
    });

    // Step 8: Validate Structured AI Output
    let validationResult = validateComparisonOutput(rawLLMOutput);

    if (!validationResult.isValid && !options.skipRetry) {
      console.warn('[COMPARISON_GEN] Initial AI comparison failed schema validation. Retrying with error feedback...');
      rawLLMOutput = await llmService.generateStructuredJSON({
        prompt: `${prompts.userPrompt}\n\nWARNING: Previous output failed schema validation with errors:\n${validationResult.errors.join('\n')}\nPlease fix all schema errors.`,
        systemPrompt: prompts.systemPrompt,
        temperature: 0.0,
        options
      });
      validationResult = validateComparisonOutput(rawLLMOutput);
    }

    if (!validationResult.isValid) {
      console.error('[COMPARISON_GEN] Validation failed:', validationResult.errors);
      throw new AppError(
        `AI improvement analysis failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    const sanitized = validationResult.sanitizedComparison;

    // Persist DiagnosticComparison Document in MongoDB Atlas
    const comparisonDoc = await DiagnosticComparison.findOneAndUpdate(
      { reassessmentAttemptId },
      {
        previousDiagnosticReportId: previousReport._id,
        newDiagnosticReportId: newReport._id,
        reassessmentAttemptId,
        studentId: newReport.studentId,
        topicId: newReport.topicId,
        teacherId: newReport.teacherId,
        improvedConcepts: sanitized.improvedConcepts,
        unchangedWeaknesses: sanitized.unchangedWeaknesses,
        newlyObservedWeaknesses: sanitized.newlyObservedWeaknesses,
        resolvedMisconceptions: sanitized.resolvedMisconceptions,
        remainingMisconceptions: sanitized.remainingMisconceptions,
        conceptualDelta: sanitized.conceptualDelta,
        proceduralDelta: sanitized.proceduralDelta,
        applicationDelta: sanitized.applicationDelta,
        overallScoreDelta: sanitized.overallScoreDelta,
        evidenceSummary: sanitized.evidenceSummary,
        remediationEffectiveness: sanitized.remediationEffectiveness,
        summary: sanitized.summary
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`[COMPARISON] Generated AI improvement analysis ID: ${comparisonDoc._id} for reassessmentAttemptId: ${reassessmentAttemptId}`);

    return comparisonDoc;
  },

  async getComparisonByAttemptId(reassessmentAttemptId, userId, userRole) {
    const comparisonDoc = await DiagnosticComparison.findOne({ reassessmentAttemptId })
      .populate('previousDiagnosticReportId')
      .populate('newDiagnosticReportId')
      .populate('studentId', 'name email');

    if (!comparisonDoc) {
      throw new AppError('Diagnostic comparison report not found for this reassessment attempt.', 404, 'COMPARISON_NOT_FOUND');
    }

    if (userRole === 'student' && comparisonDoc.studentId._id.toString() !== userId.toString() && comparisonDoc.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s diagnostic comparison.', 403, 'FORBIDDEN');
    }

    if (userRole === 'teacher' && comparisonDoc.teacherId.toString() !== userId.toString()) {
      const course = await Course.findOne({ teacherId: userId });
      if (!course) {
        throw new AppError('Access denied. You do not own this course or student comparison.', 403, 'FORBIDDEN');
      }
    }

    return comparisonDoc;
  }
};
