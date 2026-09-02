import { DiagnosticReport } from '../models/DiagnosticReport.js';
import { LearningPath } from '../models/LearningPath.js';
import { Assessment } from '../models/Assessment.js';
import { Attempt } from '../models/Attempt.js';
import { Course } from '../models/Course.js';
import { ragRetrievalService } from './rag/ragRetrievalService.js';
import { llmService } from './ai/llmService.js';
import { buildLearningPathPrompt } from './ai/prompts/learningPathPrompt.js';
import { validateLearningPathOutput } from '../utils/validators/learningPath.validator.js';
import { AppError } from '../utils/AppError.js';

const enrichLearningPathState = async (pathDoc) => {
  if (!pathDoc) return null;
  const pathObj = pathDoc.toObject ? pathDoc.toObject() : { ...pathDoc };

  const studentId = pathDoc.studentId._id || pathDoc.studentId;

  // Load diagnostic report to inspect initial or latest mastery score & status
  const report = await DiagnosticReport.findById(pathDoc.diagnosticReportId);

  const reassessmentDoc = await Assessment.findOne({
    $or: [
      { previousDiagnosticReportId: pathDoc.diagnosticReportId },
      { learningPathId: pathDoc._id }
    ],
    type: 'reassessment',
    status: { $ne: 'archived' }
  });

  let reassessmentStatus = 'not_created';
  let reassessmentId = null;
  let reassessmentAttemptId = null;

  if (reassessmentDoc) {
    reassessmentId = reassessmentDoc._id;
    const attemptDoc = await Attempt.findOne({
      assessmentId: reassessmentDoc._id,
      studentId: studentId
    }).sort({ createdAt: -1 });

    if (attemptDoc) {
      reassessmentAttemptId = attemptDoc._id;
      if (['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'].includes(attemptDoc.status)) {
        reassessmentStatus = 'completed';
      } else if (attemptDoc.status === 'in_progress') {
        reassessmentStatus = 'in_progress';
      } else {
        reassessmentStatus = 'available';
      }
    } else {
      reassessmentStatus = 'available';
    }
  }

  // Determine if mastery is already achieved on report or learning path
  const isMasteryAchieved = Boolean(
    pathDoc.status === 'completed' ||
    reassessmentStatus === 'completed' ||
    (report && (
      report.overallMasteryScore >= 75 ||
      report.masteryLevel === 'mastered' ||
      (Array.isArray(report.weakConcepts) && report.weakConcepts.length === 0)
    ))
  );

  const activitiesCompleted = pathDoc.nodes && pathDoc.nodes.length > 0 && pathDoc.nodes.every((n) => n.isCompleted);
  const isCompleted = isMasteryAchieved || pathDoc.status === 'completed' || reassessmentStatus === 'completed';

  if (isCompleted) {
    pathObj.status = 'completed';
    if (reassessmentStatus !== 'completed' && isMasteryAchieved) {
      reassessmentStatus = 'mastered';
    } else if (isCompleted) {
      reassessmentStatus = 'completed';
    }
  }

  const isReadyForReassessment = activitiesCompleted && !isCompleted && !isMasteryAchieved && reassessmentStatus !== 'in_progress' && reassessmentStatus !== 'completed' && reassessmentStatus !== 'mastered';

  pathObj.activitiesCompleted = Boolean(activitiesCompleted);
  pathObj.reassessmentStatus = reassessmentStatus;
  pathObj.reassessmentId = reassessmentId;
  pathObj.reassessmentAttemptId = reassessmentAttemptId;
  pathObj.isReadyForReassessment = Boolean(isReadyForReassessment);
  pathObj.isMastered = Boolean(isMasteryAchieved);

  return pathObj;
};

export const learningPathService = {
  async generateLearningPath({ diagnosticReportId, userId, userRole, options = {} }) {
    console.log(`[LEARNING_PATH] generation started for diagnosticId: ${diagnosticReportId}`);

    const report = await DiagnosticReport.findById(diagnosticReportId);

    if (!report) {
      console.error(`[LEARNING_PATH] generation failed for diagnosticId: ${diagnosticReportId}: Diagnostic report record not found.`);
      throw new AppError('Diagnostic report record not found.', 404, 'REPORT_NOT_FOUND');
    }

    console.log(`[LEARNING_PATH] diagnostic loaded for diagnosticId: ${report._id}, studentId: ${report.studentId}, topicId: ${report.topicId}`);

    // Security check: Student can only generate/access their own learning path
    if (userRole === 'student' && report.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s learning path.', 403, 'FORBIDDEN');
    }

    // Teacher authorization check
    if (userRole === 'teacher' && report.teacherId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You do not own this course or student diagnostic report.', 403, 'FORBIDDEN');
    }

    const isMastered = Boolean(
      report.overallMasteryScore >= 75 ||
      report.masteryLevel === 'mastered' ||
      (Array.isArray(report.weakConcepts) && report.weakConcepts.length === 0)
    );

    // If topic mastery is achieved, persist a completed learning path with 0 remediation nodes
    if (isMastered) {
      console.log(`[LEARNING_PATH] Topic mastery achieved for diagnosticId: ${report._id} (Score: ${report.overallMasteryScore}). Persisting completed learning path with 0 remediation tasks.`);
      
      const pathDoc = await LearningPath.findOneAndUpdate(
        { diagnosticReportId: report._id },
        {
          diagnosticReportId: report._id,
          attemptId: report.attemptId,
          studentId: report.studentId,
          topicId: report.topicId,
          teacherId: report.teacherId,
          title: 'Topic Mastery Pathway',
          status: 'completed',
          overallProgressPercentage: 100,
          nodes: [],
          sourceMaterialsUsed: []
        },
        { upsert: true, new: true, runValidators: true }
      );

      console.log(`[LEARNING_PATH] saved completed mastery path for learningPathId: ${pathDoc._id}, diagnosticId: ${report._id}`);

      return {
        learningPath: pathDoc,
        targetConceptsCount: 0,
        ragChunksCount: 0
      };
    }

    let targetConcepts = report.weakConcepts || [];
    const misconceptions = report.identifiedMisconceptions || [];
    const proceduralWeaknesses = report.proceduralWeaknesses || [];
    const applicationWeaknesses = report.applicationWeaknesses || [];

    // Fallback if no weak concepts array present
    if (targetConcepts.length === 0) {
      targetConcepts = [
        {
          concept: 'Polynomial Division Fundamentals',
          severity: 'medium',
          evidence: report.aiSummary || 'General topic conceptual reinforcement required.'
        }
      ];
    }

    // RAG Retrieval Step: Retrieve relevant teacher course material chunks for diagnosed weaknesses
    const weakTerms = [
      ...targetConcepts.map((c) => c.concept),
      ...proceduralWeaknesses.map((p) => p.skill),
      ...applicationWeaknesses.map((a) => a.context),
      ...misconceptions.map((m) => m.title)
    ].filter(Boolean);

    const searchQuery = weakTerms.length > 0 ? weakTerms.join(' ') : (report.aiSummary || 'Topic Fundamentals');
    let ragResult;
    try {
      ragResult = await ragRetrievalService.retrieveRelevantChunks({
        query: searchQuery,
        teacherId: report.teacherId,
        topicId: report.topicId,
        topK: 5
      });
    } catch (err) {
      // Fallback empty RAG context if search returns empty
      ragResult = { chunks: [], chunksCount: 0, context: { formattedContext: '', sourceMaterials: [] } };
    }

    // Build prompt for AI Learning Path Generator
    const prompts = buildLearningPathPrompt({
      report,
      targetConcepts,
      misconceptions,
      RAGContext: ragResult.context
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
      console.error(`[LEARNING_PATH] generation failed for diagnosticId: ${report._id}: AI learning path service invocation failed: ${err.message}`);
      throw new AppError(`AI learning path service invocation failed: ${err.message}`, 400, 'PATH_GENERATION_FAILED');
    }

    // Validate structured AI output (Never store malformed output!)
    let validationResult = validateLearningPathOutput(rawLLMOutput);

    if (!validationResult.isValid && !options.skipRetry) {
      try {
        rawLLMOutput = await llmService.generateStructuredJSON({
          prompt: `${prompts.userPrompt}\n\nWARNING: Previous output failed schema validation with errors:\n${validationResult.errors.join('\n')}\nPlease fix all schema errors.`,
          systemPrompt: prompts.systemPrompt,
          temperature: 0.0,
          options
        });
        validationResult = validateLearningPathOutput(rawLLMOutput);
      } catch (retryErr) {
        console.error(`[LEARNING_PATH] generation failed for diagnosticId: ${report._id}: AI learning path retry failed: ${retryErr.message}`);
        throw new AppError(`AI learning path retry failed: ${retryErr.message}`, 400, 'PATH_GENERATION_FAILED');
      }
    }

    if (!validationResult.isValid) {
      console.error(`[LEARNING_PATH] generation failed for diagnosticId: ${report._id}: AI output failed schema validation.`);
      throw new AppError(
        `AI learning path generation failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    console.log(`[LEARNING_PATH] recommendations generated for diagnosticId: ${report._id}`);

    const sanitizedPath = validationResult.sanitizedLearningPath;
    const sourceMaterialsUsed = ragResult.context?.sourceMaterials
      ? ragResult.context.sourceMaterials.map((s) => s.materialId)
      : [];

    // Persist LearningPath document in MongoDB Atlas
    const pathDoc = await LearningPath.findOneAndUpdate(
      { diagnosticReportId: report._id },
      {
        diagnosticReportId: report._id,
        attemptId: report.attemptId,
        studentId: report.studentId,
        topicId: report.topicId,
        teacherId: report.teacherId,
        title: sanitizedPath.title || 'Personalized Remediation Pathway',
        status: 'active',
        overallProgressPercentage: 0,
        nodes: sanitizedPath.nodes,
        sourceMaterialsUsed
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`[LEARNING_PATH] saved for learningPathId: ${pathDoc._id}, diagnosticId: ${report._id}`);

    return {
      learningPath: pathDoc,
      targetConceptsCount: targetConcepts.length,
      ragChunksCount: ragResult.chunksCount
    };
  },

  async getLearningPath({ diagnosticReportId, userId, userRole }) {
    const pathDoc = await LearningPath.findOne({ diagnosticReportId })
      .populate('topicId', 'title order')
      .populate('studentId', 'name email');

    if (!pathDoc) {
      throw new AppError('Learning path record not found for this diagnostic report.', 404, 'PATH_NOT_FOUND');
    }

    // Security check: Student can only access their own learning path
    if (userRole === 'student' && pathDoc.studentId._id.toString() !== userId.toString() && pathDoc.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s learning path.', 403, 'FORBIDDEN');
    }

    // Security check: Teacher can only access learning paths for courses they own
    if (userRole === 'teacher' && pathDoc.teacherId.toString() !== userId.toString()) {
      const course = await Course.findOne({ teacherId: userId });
      if (!course) {
        throw new AppError('Access denied. You do not own this course or student learning path.', 403, 'FORBIDDEN');
      }
    }

    return await enrichLearningPathState(pathDoc);
  },

  async getStudentLearningPaths(studentId) {
    const paths = await LearningPath.find({ studentId })
      .populate('topicId', 'title order')
      .sort({ createdAt: -1 });

    const enrichedPaths = await Promise.all(paths.map((p) => enrichLearningPathState(p)));
    return enrichedPaths;
  },

  async getLearningPathById({ pathId, userId, userRole }) {
    const pathDoc = await LearningPath.findById(pathId)
      .populate('topicId', 'title order')
      .populate('studentId', 'name email');

    if (!pathDoc) {
      throw new AppError('Learning path record not found.', 404, 'PATH_NOT_FOUND');
    }

    if (userRole === 'student' && pathDoc.studentId._id.toString() !== userId.toString() && pathDoc.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You cannot access another student\'s learning path.', 403, 'FORBIDDEN');
    }

    if (userRole === 'teacher' && pathDoc.teacherId.toString() !== userId.toString()) {
      const course = await Course.findOne({ teacherId: userId });
      if (!course) {
        throw new AppError('Access denied. You do not own this course or student learning path.', 403, 'FORBIDDEN');
      }
    }

    return await enrichLearningPathState(pathDoc);
  },

  async completeLearningNode({ pathId, nodeId, userId }) {
    const pathDoc = await LearningPath.findById(pathId);

    if (!pathDoc) {
      throw new AppError('Learning path record not found.', 404, 'PATH_NOT_FOUND');
    }

    if (pathDoc.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You do not own this learning path.', 403, 'FORBIDDEN');
    }

    const nodeIndex = pathDoc.nodes.findIndex((n) => n.nodeId === nodeId || n._id?.toString() === nodeId);

    if (nodeIndex === -1) {
      throw new AppError('Specified learning node does not exist in this learning path.', 400, 'NODE_NOT_FOUND');
    }

    // Toggle completion status or set to completed
    const node = pathDoc.nodes[nodeIndex];
    node.isCompleted = !node.isCompleted;
    node.completedAt = node.isCompleted ? new Date() : null;

    // Recalculate progress percentage
    const completedCount = pathDoc.nodes.filter((n) => n.isCompleted).length;
    const totalCount = pathDoc.nodes.length;
    pathDoc.overallProgressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    await pathDoc.save();

    const reloaded = await LearningPath.findById(pathId)
      .populate('topicId', 'title order')
      .populate('studentId', 'name email');

    return await enrichLearningPathState(reloaded);
  }
};

