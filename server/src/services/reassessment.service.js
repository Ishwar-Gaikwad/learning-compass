import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { DiagnosticReport } from '../models/DiagnosticReport.js';
import { LearningPath } from '../models/LearningPath.js';
import { Assessment } from '../models/Assessment.js';
import { Attempt } from '../models/Attempt.js';
import { Topic } from '../models/Topic.js';
import { generateUniqueAccessCode } from './assessment.service.js';
import { evaluationService } from './evaluation.service.js';
import { diagnosticService } from './diagnostic.service.js';
import { comparisonService } from './comparison.service.js';
import { ragRetrievalService } from './rag/ragRetrievalService.js';
import { llmService } from './ai/llmService.js';
import { buildReassessmentPrompt } from './ai/prompts/reassessmentPrompt.js';
import { validateLLMAssessmentOutput } from '../utils/validators/assessment.validator.js';
import { AppError } from '../utils/AppError.js';

function isQuestionDuplicate(newText, originalTexts) {
  if (!newText || !originalTexts || originalTexts.length === 0) return false;
  const cleanNew = newText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  for (const orig of originalTexts) {
    if (!orig || typeof orig !== 'string') continue;
    const cleanOrig = orig.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (cleanNew === cleanOrig) return true;

    const setA = new Set(cleanNew.split(/\s+/).filter(Boolean));
    const setB = new Set(cleanOrig.split(/\s+/).filter(Boolean));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size > 0 && intersection.size / union.size >= 0.8) {
      return true;
    }
  }
  return false;
}

export const reassessmentService = {
  async generateReassessment({ diagnosticReportId, userId, userRole, options = {} }) {
    const report = await DiagnosticReport.findById(diagnosticReportId);

    if (!report) {
      throw new AppError('Diagnostic report record not found.', 404, 'REPORT_NOT_FOUND');
    }

    // Security check: Student can only generate/access their own reassessment
    if (userRole === 'student' && report.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot generate a reassessment for another student.', 403, 'FORBIDDEN');
    }

    // Teacher authorization check
    if (userRole === 'teacher' && report.teacherId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You do not own this course or student diagnostic report.', 403, 'FORBIDDEN');
    }

    const learningPath = await LearningPath.findOne({ diagnosticReportId: report._id });

    if (learningPath && learningPath.status === 'completed') {
      throw new AppError('Mastery threshold or remediation cycle already completed for this topic. No further targeted reassessment is required.', 400, 'MASTERY_ACHIEVED');
    }

    // Check if mastery threshold was already achieved on previous report
    if (report.overallMasteryScore >= 75 || report.masteryLevel === 'mastered' || (report.weakConcepts && report.weakConcepts.length === 0)) {
      throw new AppError('Mastery threshold already achieved for this topic. No further targeted reassessment is required.', 400, 'MASTERY_ACHIEVED');
    }

    // Remediation Progress Verification: Enforce that student must complete assigned learning path nodes
    if (learningPath && Array.isArray(learningPath.nodes) && learningPath.nodes.length > 0) {
      const hasCompletedNodes = learningPath.nodes.some((node) => node.isCompleted);
      if (!hasCompletedNodes && !options.skipRemediationCheck) {
        throw new AppError('Learning path remediation activities must be completed before a targeted reassessment can be generated.', 400, 'REMEDIATION_INCOMPLETE');
      }
    }

    // Idempotency check: Reuse existing active/unsubmitted targeted reassessment if available
    const existingReassessment = await Assessment.findOne({
      previousDiagnosticReportId: report._id,
      type: 'reassessment',
      status: { $ne: 'archived' }
    });

    if (existingReassessment) {
      const attemptDoc = await Attempt.findOne({
        assessmentId: existingReassessment._id,
        studentId: report.studentId
      }).sort({ createdAt: -1 });

      if (attemptDoc && ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'].includes(attemptDoc.status)) {
        throw new AppError('Mastery threshold or remediation cycle already completed for this topic. No further targeted reassessment is required.', 400, 'MASTERY_ACHIEVED');
      }

      console.log(`[REASSESSMENT] Reusing existing reassessment ID: ${existingReassessment._id}`);
      await AssessmentAssignment.findOneAndUpdate(
        { studentId: report.studentId, assessmentId: existingReassessment._id },
        { $setOnInsert: { status: 'assigned', joinedAt: new Date() } },
        { upsert: true, new: true }
      );
      return {
        reassessment: existingReassessment,
        targetedConcepts: existingReassessment.targetedConcepts || [],
        previousDiagnosticReportId: report._id,
        isExisting: true
      };
    }

    const topic = await Topic.findById(report.topicId);
    if (!topic) {
      throw new AppError('Parent topic record not found.', 404, 'TOPIC_NOT_FOUND');
    }

    // Step 2 & 3: Extract Remediated & Diagnosed Weak Concepts
    const completedNodes = (learningPath?.nodes || []).filter((n) => n.isCompleted);
    let remediatedConcepts = [...new Set(completedNodes.map((n) => n.targetConcept))].filter(Boolean);

    if (remediatedConcepts.length === 0) {
      remediatedConcepts = (report.weakConcepts || []).map((w) => w.concept).filter(Boolean);
    }

    if (remediatedConcepts.length === 0) {
      throw new AppError('No diagnosed weak concepts found for targeted reassessment.', 400, 'NO_DIAGNOSED_WEAKNESS');
    }

    // Extract Original Assessment Questions (for Question Leakage Protection)
    let originalQuestions = [];
    if (report.attemptId) {
      const initialAttempt = await Attempt.findById(report.attemptId);
      if (initialAttempt) {
        const initialAssessment = await Assessment.findById(initialAttempt.assessmentId);
        if (initialAssessment && Array.isArray(initialAssessment.questions)) {
          originalQuestions = initialAssessment.questions.map((q) => q.questionText);
        }
      }
    }

    // Step 4: RAG Vector Retrieval for Remediated Concepts
    const searchQuery = remediatedConcepts.join(' ');
    let retrievalResult;
    try {
      retrievalResult = await ragRetrievalService.retrieveRelevantChunks({
        query: searchQuery,
        teacherId: report.teacherId,
        topicId: report.topicId,
        topK: Math.max(remediatedConcepts.length * 2, 5)
      });
    } catch (ragErr) {
      console.warn(`[REASSESSMENT] RAG retrieval fallback for topic ${report.topicId}:`, ragErr.message);
      retrievalResult = { chunks: [], chunksCount: 0, context: { formattedContext: '', sourceMaterials: [] } };
    }

    console.log(`[REASSESSMENT_GEN] RAG retrieval completed. Chunks count: ${retrievalResult.chunksCount}, Model: ${llmService.getModelName()}`);

    // Step 5: Construct Targeted Reassessment Prompts
    const totalQuestions = Math.max(remediatedConcepts.length, 2);
    const prompts = buildReassessmentPrompt({
      report,
      learningPath,
      remediatedConcepts,
      originalQuestions,
      RAGContext: retrievalResult.context,
      totalQuestions,
      difficulty: 'medium'
    });

    // Step 6 & 7: AI Structured JSON Generation
    let rawLLMOutput = await llmService.generateStructuredJSON({
      prompt: prompts.userPrompt,
      systemPrompt: prompts.systemPrompt,
      temperature: 0.1,
      options
    });

    // Step 8 & 9: Validation & Duplicate Question Detection
    let validationResult = validateLLMAssessmentOutput(rawLLMOutput, retrievalResult.context.sourceMaterials);
    let duplicateError = null;

    if (validationResult.isValid && Array.isArray(validationResult.sanitizedAssessment?.questions)) {
      for (let idx = 0; idx < validationResult.sanitizedAssessment.questions.length; idx++) {
        const q = validationResult.sanitizedAssessment.questions[idx];
        if (isQuestionDuplicate(q.questionText, originalQuestions)) {
          duplicateError = `Question #${idx + 1} is a duplicate or near-duplicate of an original assessment question.`;
          validationResult.isValid = false;
          validationResult.errors = validationResult.errors || [];
          validationResult.errors.push(duplicateError);
          break;
        }
      }
    }

    // Retry once if schema validation or duplicate check fails
    if (!validationResult.isValid && !options.skipRetry) {
      console.warn('[REASSESSMENT_GEN] Initial AI output failed schema/duplicate validation. Retrying with error feedback...');
      rawLLMOutput = await llmService.generateStructuredJSON({
        prompt: `${prompts.userPrompt}\n\nWARNING: Previous output failed validation with errors:\n${validationResult.errors.join('\n')}\nPlease generate fresh, non-duplicate questions matching the requested schema.`,
        systemPrompt: prompts.systemPrompt,
        temperature: 0.0,
        options
      });

      validationResult = validateLLMAssessmentOutput(rawLLMOutput, retrievalResult.context.sourceMaterials);

      if (validationResult.isValid && Array.isArray(validationResult.sanitizedAssessment?.questions)) {
        for (let idx = 0; idx < validationResult.sanitizedAssessment.questions.length; idx++) {
          const q = validationResult.sanitizedAssessment.questions[idx];
          if (isQuestionDuplicate(q.questionText, originalQuestions)) {
            validationResult.isValid = false;
            validationResult.errors = validationResult.errors || [];
            validationResult.errors.push(`Question #${idx + 1} is a duplicate of an original question.`);
            break;
          }
        }
      }
    }

    // Reject invalid output (0 invalid records saved!)
    if (!validationResult.isValid) {
      console.error('[REASSESSMENT_GEN] Reassessment AI validation failed:', validationResult.errors);
      throw new AppError(
        `AI targeted reassessment generation failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    const sanitizedData = validationResult.sanitizedAssessment;
    const sourceMaterialsUsed = (retrievalResult.context.sourceMaterials || []).map((sm) => sm.materialId);
    const accessCode = await generateUniqueAccessCode();

    // Step 10: Persist Reassessment Assessment Document in MongoDB
    const reassessment = await Assessment.create({
      teacherId: report.teacherId,
      courseId: topic.courseId,
      topicId: report.topicId,
      accessCode,
      title: `Targeted Reassessment: ${topic.title}`,
      description: `Targeted reassessment testing concept recovery for ${remediatedConcepts.join(', ')}`,
      type: 'reassessment',
      previousDiagnosticReportId: report._id,
      parentAssessmentId: report.assessmentId,
      learningPathId: learningPath ? learningPath._id : undefined,
      targetedConcepts: remediatedConcepts,
      difficulty: sanitizedData.difficulty || 'medium',
      totalQuestions: sanitizedData.questions.length,
      questions: sanitizedData.questions,
      sourceMaterialsUsed,
      status: 'published'
    });

    await AssessmentAssignment.findOneAndUpdate(
      { studentId: report.studentId, assessmentId: reassessment._id },
      { $setOnInsert: { status: 'assigned', joinedAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log(`[REASSESSMENT] Generated AI targeted reassessment ID: ${reassessment._id} for reportId: ${report._id}`);

    return {
      reassessment,
      targetedConcepts: remediatedConcepts,
      previousDiagnosticReportId: report._id,
      isExisting: false
    };
  },

  async processReassessmentSubmission({ reassessmentAttemptId, userId, userRole, options = {} }) {
    const attempt = await Attempt.findById(reassessmentAttemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (userRole === 'student' && attempt.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot process another student\'s reassessment attempt.', 403, 'FORBIDDEN');
    }

    if (attempt.status === 'in_progress') {
      throw new AppError('Cannot process an unsubmitted reassessment attempt. Please submit the attempt first.', 400, 'ATTEMPT_NOT_SUBMITTED');
    }

    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment || assessment.type !== 'reassessment' || !assessment.previousDiagnosticReportId) {
      throw new AppError('Specified attempt is not associated with a targeted reassessment.', 400, 'NOT_A_REASSESSMENT');
    }

    // 1. REUSE existing evaluationService to evaluate reassessment responses
    await evaluationService.evaluateAttempt({ attemptId: attempt._id, userId, userRole, options });

    // 2. REUSE existing diagnosticService to generate new diagnostic report (without triggering duplicate learning paths)
    const newDiagResult = await diagnosticService.generateDiagnosticReport({ attemptId: attempt._id, userId, userRole, options });

    // 3. REUSE comparisonService to compare previous vs new diagnostic reports
    const comparisonDoc = await comparisonService.compareDiagnostics({
      previousReportId: assessment.previousDiagnosticReportId,
      newReportId: newDiagResult.report._id,
      reassessmentAttemptId: attempt._id,
      userId,
      userRole,
      options
    });

    // 4. Learning Path Completion
    const overallMasteryScore = newDiagResult.report.overallMasteryScore || 0;
    const isMastered = overallMasteryScore >= 75 || (newDiagResult.report.weakConcepts && newDiagResult.report.weakConcepts.length === 0);

    const learningPath = await LearningPath.findOne({
      $or: [
        { diagnosticReportId: assessment.previousDiagnosticReportId },
        { _id: assessment.learningPathId }
      ]
    });

    if (learningPath) {
      learningPath.status = 'completed';
      learningPath.overallProgressPercentage = 100;
      await learningPath.save();
      console.log(`[REASSESSMENT] Remediation cycle completed (${overallMasteryScore}%). LearningPath ${learningPath._id} marked completed.`);
    }

    return {
      attempt,
      newDiagnosticReport: newDiagResult.report,
      comparison: comparisonDoc,
      isMastered,
      cycleStatus: isMastered ? 'mastered' : 'remediation_updated'
    };
  }
};
