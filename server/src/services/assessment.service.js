import { Assessment } from '../models/Assessment.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { Attempt } from '../models/Attempt.js';
import { Material } from '../models/Material.js';
import { courseService } from './course.service.js';
import { topicService } from './topic.service.js';
import { ragRetrievalService } from './rag/ragRetrievalService.js';
import { llmService } from './ai/llmService.js';
import { buildAssessmentPrompt } from './ai/prompts/assessmentPrompt.js';
import { validateLLMAssessmentOutput } from '../utils/validators/assessment.validator.js';
import { AppError } from '../utils/AppError.js';

export const generateUniqueAccessCode = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 20) {
    attempts++;
    let randomChars = '';
    for (let i = 0; i < 6; i++) {
      randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `LC-${randomChars}`;
    const existing = await Assessment.findOne({ accessCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

export const assessmentService = {
  async generateAssessment({
    courseId,
    topicId,
    teacherId,
    title,
    totalQuestions = 5,
    difficulty = 'medium',
    questionTypes = ['mcq', 'short_answer'],
    additionalInstructions,
    options = {}
  }) {
    // Step 1: Enforce teacher ownership of parent Course and Topic
    await courseService.getCourseById(courseId, teacherId);
    const topic = await topicService.getTopicById(topicId, teacherId);

    if (topic.courseId.toString() !== courseId.toString()) {
      throw new AppError('Topic does not belong to the specified course.', 400, 'INVALID_TOPIC_COURSE_RELATION');
    }

    // Step 1.1: Verify & fetch materials for requested topic/course
    const materials = await Material.find({
      topicId: topic._id,
      courseId: topic.courseId,
      teacherId
    }).lean();

    const materialIds = materials.map((m) => m._id.toString());

    if (materialIds.length === 0) {
      throw new AppError('No processed learning materials found for this topic. Please upload and process material before generating an assessment.', 400, 'NO_MATERIAL_CONTEXT');
    }

    // Step 2: RAG Retrieval Step (retrieve grounded context from vector index BEFORE LLM call)
    const retrievalResult = await ragRetrievalService.retrieveRelevantChunks({
      query: topic.title,
      teacherId,
      courseId,
      topicId,
      materialIds,
      topK: Math.max(totalQuestions * 2, 5)
    });

    if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
      throw new AppError('No processed learning materials found for this topic. Please upload and process material before generating an assessment.', 400, 'NO_MATERIAL_CONTEXT');
    }

    console.log(`[ASSESSMENT_GEN] RAG retrieval completed. Chunks count: ${retrievalResult.chunksCount}, Model: ${llmService.getModelName()}`);

    // Step 3: Construct prompts using retrieved RAG context and source citations
    const prompts = buildAssessmentPrompt({
      topicTitle: topic.title,
      contextData: retrievalResult.context,
      totalQuestions,
      difficulty,
      questionTypes,
      additionalInstructions
    });

    // Step 4: Invoke LLM service for structured JSON generation
    let rawLLMOutput = await llmService.generateStructuredJSON({
      prompt: prompts.userPrompt,
      systemPrompt: prompts.systemPrompt,
      temperature: 0.1,
      options
    });

    // Step 5: Schema Validation (Never trust raw LLM output directly!)
    let validationResult = validateLLMAssessmentOutput(rawLLMOutput, retrievalResult.context.sourceMaterials);

    if (!validationResult.isValid && !options.skipRetry) {
      console.warn('[ASSESSMENT_GEN] Initial LLM output failed schema validation. Attempting retry with error feedback...');
      // Retry once with error feedback if output failed schema validation
      rawLLMOutput = await llmService.generateStructuredJSON({
        prompt: `${prompts.userPrompt}\n\nWARNING: Your previous output failed schema validation with errors:\n${validationResult.errors.join('\n')}\nPlease fix all schema errors.`,
        systemPrompt: prompts.systemPrompt,
        temperature: 0.0,
        options
      });
      validationResult = validateLLMAssessmentOutput(rawLLMOutput, retrievalResult.context.sourceMaterials);
    }

    if (!validationResult.isValid) {
      console.error('[ASSESSMENT_GEN] Validation failed:', validationResult.errors);
      throw new AppError(
        `AI assessment generation failed schema validation: ${validationResult.errors.join('; ')}`,
        400,
        'INVALID_AI_OUTPUT'
      );
    }

    console.log('[ASSESSMENT_GEN] Assessment generation & schema validation succeeded 100%.');

    const sanitizedData = validationResult.sanitizedAssessment;
    const sourceMaterialsUsed = retrievalResult.context.sourceMaterials.map((sm) => sm.materialId);

    // Generate unique access code (Format: LC-XXXXXX)
    const accessCode = await generateUniqueAccessCode();

    // Step 6: Persist validated Assessment record in MongoDB Atlas
    const assessment = await Assessment.create({
      teacherId,
      courseId,
      topicId,
      accessCode,
      title: title && title.trim().length > 0 ? title.trim() : (sanitizedData.title || `${topic.title} Diagnostic Assessment`),
      difficulty: sanitizedData.difficulty || difficulty,
      totalQuestions: sanitizedData.questions.length,
      questions: sanitizedData.questions,
      sourceMaterialsUsed,
      status: 'published'
    });

    return {
      assessment,
      accessCode: assessment.accessCode,
      retrievedChunksCount: retrievalResult.chunksCount,
      sourceMaterialsCount: sourceMaterialsUsed.length
    };
  },

  async joinAssessmentByCode({ accessCode, studentId }) {
    if (!accessCode || typeof accessCode !== 'string' || accessCode.trim().length === 0) {
      throw new AppError('Assessment access code is required.', 400, 'MISSING_ACCESS_CODE');
    }

    const normalizedCode = accessCode.trim().toUpperCase();

    const assessment = await Assessment.findOne({ accessCode: normalizedCode, status: 'published' })
      .populate('courseId', 'title code subject gradeLevel')
      .populate('topicId', 'title order');

    if (!assessment) {
      throw new AppError('Invalid assessment access code or assessment is unavailable.', 404, 'INVALID_ACCESS_CODE');
    }

    // Check for existing assignment (idempotency check)
    let assignment = await AssessmentAssignment.findOne({ studentId, assessmentId: assessment._id });

    if (assignment) {
      return {
        assignment,
        assessment,
        accessCode: assessment.accessCode,
        isExisting: true,
        message: 'You have already joined this assessment.'
      };
    }

    assignment = await AssessmentAssignment.findOneAndUpdate(
      { studentId, assessmentId: assessment._id },
      { $setOnInsert: { status: 'assigned', joinedAt: new Date() } },
      { upsert: true, new: true }
    );

    return {
      assignment,
      assessment,
      accessCode: assessment.accessCode,
      isExisting: false,
      message: 'Successfully joined assessment.'
    };
  },

  async getAssessmentById(assessmentId, teacherId) {
    const assessment = await Assessment.findById(assessmentId)
      .populate('courseId', 'title code')
      .populate('topicId', 'title order');

    if (!assessment) {
      throw new AppError('Assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (assessment.teacherId.toString() !== teacherId.toString()) {
      throw new AppError('Access denied. You do not own this assessment.', 403, 'FORBIDDEN');
    }

    return assessment;
  },

  async getAssessmentsByTopic(courseId, topicId, teacherId) {
    await courseService.getCourseById(courseId, teacherId);
    await topicService.getTopicById(topicId, teacherId);

    // Return only root/teacher-created assessments (exclude student-specific targeted reassessments)
    const assessments = await Assessment.find({
      courseId,
      topicId,
      teacherId,
      type: { $ne: 'reassessment' }
    }).sort({ createdAt: -1 });

    return assessments;
  },

  async getAvailableStudentAssessments(studentId) {
    // Only return assessments assigned/joined by this student
    const assignments = await AssessmentAssignment.find({ studentId });
    const assignedAssessmentIds = assignments.map((a) => a.assessmentId);

    if (assignedAssessmentIds.length === 0) {
      return [];
    }

    const assessments = await Assessment.find({
      _id: { $in: assignedAssessmentIds },
      status: 'published'
    })
      .populate('courseId', 'title code subject gradeLevel')
      .populate('topicId', 'title order')
      .sort({ createdAt: -1 });

    const attempts = await Attempt.find({ studentId });
    const attemptMap = {};
    const isCompletedState = (st) =>
      ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed', 'failed'].includes(st);

    attempts.forEach((a) => {
      if (!a.assessmentId) return;
      const rawAssId = a.assessmentId._id ? a.assessmentId._id : a.assessmentId;
      const assIdStr = rawAssId.toString();
      const existing = attemptMap[assIdStr];

      if (!existing) {
        attemptMap[assIdStr] = a;
      } else {
        const aCompleted = isCompletedState(a.status);
        const existingCompleted = isCompletedState(existing.status);

        if (aCompleted && !existingCompleted) {
          // Completed attempt takes precedence over an in_progress attempt
          attemptMap[assIdStr] = a;
        } else if (aCompleted === existingCompleted) {
          // If both are completed or both are in_progress, select the latest attempt
          const aTime = new Date(a.submittedAt || a.createdAt || 0).getTime();
          const existingTime = new Date(existing.submittedAt || existing.createdAt || 0).getTime();
          if (aTime > existingTime) {
            attemptMap[assIdStr] = a;
          }
        }
        // If existing is completed and 'a' is not completed, preserve existing!
      }
    });

    return assessments.map((assessment) => {
      const plain = assessment.toObject();
      const assIdStr = assessment._id.toString();
      const userAttempt = attemptMap[assIdStr];

      let attemptStatus = null;
      let canStart = true;
      let canResume = false;
      let hasCompletedAttempt = false;

      if (userAttempt) {
        const rawStatus = userAttempt.status;
        attemptStatus = rawStatus === 'completed' ? 'evaluated' : rawStatus;

        if (rawStatus === 'in_progress') {
          canStart = false;
          canResume = true;
          hasCompletedAttempt = false;
        } else if (isCompletedState(rawStatus)) {
          canStart = false;
          canResume = false;
          hasCompletedAttempt = true;
        }
      }

      return {
        ...plain,
        assessmentId: assessment._id,
        assessmentType: assessment.type || 'initial_diagnostic',
        attemptStatus,
        userAttemptStatus: attemptStatus || 'assigned',
        hasAttempt: !!userAttempt,
        hasCompletedAttempt,
        canStart,
        canResume,
        attemptId: userAttempt ? userAttempt._id : null,
        submittedAt: userAttempt?.submittedAt || null,
        completedAt: userAttempt?.completedAt || userAttempt?.submittedAt || null
      };
    });
  }
};

