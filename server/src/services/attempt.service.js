import { Attempt } from '../models/Attempt.js';
import { AttemptResponse } from '../models/AttemptResponse.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { DiagnosticReport } from '../models/DiagnosticReport.js';
import { diagnosticService } from './diagnostic.service.js';
import { AppError } from '../utils/AppError.js';

const populateOptions = {
  path: 'assessmentId',
  populate: [
    { path: 'courseId', select: 'title code subject gradeLevel' },
    { path: 'topicId', select: 'title order' }
  ]
};

export const cleanStaleDuplicateAttempts = async (assessmentId, studentId) => {
  const query = {};
  if (assessmentId) query.assessmentId = assessmentId;
  if (studentId) query.studentId = studentId;

  // Find all completed/submitted attempts
  const completedAttempts = await Attempt.find({
    ...query,
    status: { $in: ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'] }
  });

  for (const completed of completedAttempts) {
    const cutoffTime = completed.submittedAt || completed.createdAt;

    // Locate any in_progress attempts created at or before the completion cutoff
    const staleAttempts = await Attempt.find({
      assessmentId: completed.assessmentId,
      studentId: completed.studentId,
      status: 'in_progress',
      _id: { $ne: completed._id },
      createdAt: { $lte: cutoffTime }
    });

    for (const stale of staleAttempts) {
      const responseCount = await AttemptResponse.countDocuments({ attemptId: stale._id });
      // Delete unsubmitted stale attempt left behind prior to completion
      if (responseCount === 0) {
        await Attempt.findByIdAndDelete(stale._id);
        await AttemptResponse.deleteMany({ attemptId: stale._id });
        console.log(`[ATTEMPT_CLEANUP] Deleted stale in_progress attempt ${stale._id} for student ${completed.studentId}`);
      }
    }
  }
};

export const attemptService = {
  async startAttempt({ assessmentId, studentId, allowNewAttempt = false }) {
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      throw new AppError('Assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (assessment.status === 'archived') {
      throw new AppError('This assessment is archived and cannot be attempted.', 400, 'ASSESSMENT_ARCHIVED');
    }

    // Security check: Verify student is assigned to this assessment via AssessmentAssignment (or auto-assign if reassessment)
    let assignment = await AssessmentAssignment.findOne({ studentId, assessmentId });

    if (!assignment) {
      if (assessment.type === 'reassessment') {
        assignment = await AssessmentAssignment.findOneAndUpdate(
          { studentId, assessmentId },
          { $setOnInsert: { status: 'assigned', joinedAt: new Date() } },
          { upsert: true, new: true }
        );
      } else {
        throw new AppError('Access denied. You must join this assessment using an access code before starting an attempt.', 403, 'NOT_ASSIGNED');
      }
    }

    if (assignment && assignment.status === 'assigned') {
      assignment.status = 'in_progress';
      assignment.startedAt = new Date();
      await assignment.save();
    }

    // 1. Check for an existing active (in_progress) attempt
    let attempt = await Attempt.findOne({ assessmentId, studentId, status: 'in_progress' }).populate(populateOptions);

    if (attempt) {
      return {
        attempt,
        isExisting: true
      };
    }

    // 2. If allowNewAttempt is false, return any existing completed attempt instead of creating a duplicate
    if (!allowNewAttempt) {
      attempt = await Attempt.findOne({
        assessmentId,
        studentId,
        status: { $in: ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed', 'failed'] }
      }).sort({ submittedAt: -1, createdAt: -1 }).populate(populateOptions);

      if (attempt) {
        return {
          attempt,
          isExisting: true
        };
      }
    }

    // Clean up any stale unsubmitted empty attempts before creating a new one
    await cleanStaleDuplicateAttempts(assessmentId, studentId);

    attempt = await Attempt.create({
      assessmentId,
      studentId,
      status: 'in_progress',
      startedAt: new Date()
    });

    attempt = await Attempt.findById(attempt._id).populate(populateOptions);

    return {
      attempt,
      isExisting: false
    };
  },

  async getCurrentAttempt({ assessmentId, studentId }) {
    let attempt = await Attempt.findOne({ assessmentId, studentId, status: 'in_progress' }).populate(populateOptions);

    if (!attempt) {
      // Check if there is a submitted/evaluated attempt for this assessment
      attempt = await Attempt.findOne({ assessmentId, studentId, status: { $ne: 'in_progress' } }).sort({ submittedAt: -1 }).populate(populateOptions);
    }

    if (!attempt) {
      throw new AppError('No assessment attempt found for this topic.', 404, 'ATTEMPT_NOT_FOUND');
    }

    const responses = await AttemptResponse.find({ attemptId: attempt._id });

    return {
      attempt,
      responses
    };
  },

  async getAttemptById({ attemptId, userId, userRole }) {
    const attempt = await Attempt.findById(attemptId).populate(populateOptions);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (userRole === 'student' && attempt.studentId.toString() !== userId.toString()) {
      throw new AppError('Access denied. You do not own this attempt session.', 403, 'FORBIDDEN');
    }

    const responses = await AttemptResponse.find({ attemptId: attempt._id });

    return {
      attempt,
      responses
    };
  },

  async saveResponse({ attemptId, questionId, studentAnswer, studentId }) {
    if (!studentAnswer || typeof studentAnswer !== 'string' || studentAnswer.trim().length === 0) {
      throw new AppError('Student answer is required.', 400, 'MISSING_ANSWER');
    }

    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.studentId.toString() !== studentId.toString()) {
      throw new AppError('Access denied. You do not own this attempt session.', 403, 'FORBIDDEN');
    }

    if (attempt.status !== 'in_progress') {
      throw new AppError('Cannot modify or submit answers to a submitted assessment attempt.', 400, 'ATTEMPT_ALREADY_SUBMITTED');
    }

    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) {
      throw new AppError('Parent assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    const questionExists = assessment.questions.some((q) => q._id.toString() === questionId.toString());
    if (!questionExists) {
      throw new AppError('Specified question does not exist on this assessment.', 400, 'INVALID_QUESTION');
    }

    const responseDoc = await AttemptResponse.findOneAndUpdate(
      { attemptId: attempt._id, questionId },
      {
        assessmentId: attempt.assessmentId,
        studentId,
        studentAnswer: studentAnswer.trim()
      },
      { upsert: true, new: true, runValidators: true }
    );

    return responseDoc;
  },

  async submitAttempt({ attemptId, studentId }) {
    let attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      throw new AppError('Attempt record not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.studentId.toString() !== studentId.toString()) {
      throw new AppError('Access denied. You do not own this attempt session.', 403, 'FORBIDDEN');
    }

    if (attempt.status !== 'in_progress') {
      throw new AppError('Cannot submit an already submitted assessment attempt.', 400, 'ATTEMPT_ALREADY_SUBMITTED');
    }

    console.log(`[ASSESSMENT] submission received for attemptId: ${attemptId}`);

    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    attempt.completedAt = attempt.submittedAt;
    attempt.processingError = undefined;
    await attempt.save();

    await AssessmentAssignment.findOneAndUpdate(
      { studentId, assessmentId: attempt.assessmentId },
      { $set: { status: 'submitted', submittedAt: attempt.submittedAt } },
      { upsert: true, new: true }
    );

    // Clean up phantom/duplicate in_progress attempts for this student and assessment
    await cleanStaleDuplicateAttempts(attempt.assessmentId, studentId);

    console.log(`[ASSESSMENT] responses locked for attemptId: ${attemptId}`);

    attempt = await Attempt.findById(attempt._id).populate(populateOptions);

    const responses = await AttemptResponse.find({ attemptId: attempt._id });

    // Trigger asynchronous response evaluation & diagnostic report generation
    setImmediate(async () => {
      try {
        await diagnosticService.generateDiagnosticReport({
          attemptId: attempt._id,
          userId: studentId,
          userRole: 'student'
        });
      } catch (procErr) {
        console.error(`[AttemptSubmission] Background diagnostic processing failed for attempt ${attempt._id}:`, procErr);
        await Attempt.findByIdAndUpdate(attempt._id, {
          status: 'failed',
          processingError: procErr.message || 'Diagnostic report processing failed.'
        });
      }
    });

    return {
      attempt,
      responsesCount: responses.length,
      responses
    };
  },

  async getAssessmentAttempts({ assessmentId, teacherId }) {
    const rootAssessment = await Assessment.findById(assessmentId);

    if (!rootAssessment) {
      throw new AppError('Assessment record not found.', 404, 'ASSESSMENT_NOT_FOUND');
    }

    if (rootAssessment.teacherId.toString() !== teacherId.toString()) {
      throw new AppError('Access denied. You do not own this assessment.', 403, 'FORBIDDEN');
    }

    // Clean up stale duplicate attempts before returning attempts to teacher modal
    await cleanStaleDuplicateAttempts(assessmentId);

    // 1. Find all DiagnosticReports generated from initial attempts for this root assessment
    const initialReports = await DiagnosticReport.find({ assessmentId: rootAssessment._id });
    const reportIds = initialReports.map((r) => r._id);

    // 2. Find all child targeted reassessments linked to this root assessment
    const reassessments = await Assessment.find({
      $or: [
        { previousDiagnosticReportId: { $in: reportIds } },
        { parentAssessmentId: rootAssessment._id },
        { _id: rootAssessment._id }
      ]
    });
    const relatedAssessmentIds = reassessments.map((r) => r._id);

    // 3. Query all Attempts across root assessment and all reassessments
    const attempts = await Attempt.find({ assessmentId: { $in: relatedAssessmentIds } })
      .populate('studentId', 'name email')
      .populate({
        path: 'assessmentId',
        select: 'title type previousDiagnosticReportId parentAssessmentId targetedConcepts'
      })
      .sort({ createdAt: 1 });

    // 4. Enrich each attempt with its diagnostic report and evaluated responses
    const enrichedAttempts = await Promise.all(
      attempts.map(async (attemptDoc) => {
        const attemptObj = attemptDoc.toObject();

        const report = await DiagnosticReport.findOne({ attemptId: attemptDoc._id }).select(
          'overallMasteryScore masteryLevel aiSummary createdAt'
        );
        const responses = await AttemptResponse.find({ attemptId: attemptDoc._id })
          .populate('questionId', 'questionText questionType correctAnswer expectedConcepts')
          .sort({ createdAt: 1 });

        return {
          ...attemptObj,
          diagnosticReport: report || null,
          responses: responses || []
        };
      })
    );

    return enrichedAttempts;
  }
};


