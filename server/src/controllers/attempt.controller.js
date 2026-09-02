import { attemptService } from '../services/attempt.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const startAttempt = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const { allowNewAttempt } = req.body || {};

  const result = await attemptService.startAttempt({
    assessmentId,
    studentId: req.user._id,
    allowNewAttempt: Boolean(allowNewAttempt || req.query.allowNewAttempt === 'true')
  });

  const statusCode = result.isExisting ? 200 : 201;
  const message = result.isExisting
    ? 'Active assessment attempt resumed successfully'
    : 'Assessment attempt started successfully';

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      attempt: result.attempt
    }
  });
});

export const getCurrentAttempt = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const result = await attemptService.getCurrentAttempt({
    assessmentId,
    studentId: req.user._id
  });

  res.status(200).json({
    success: true,
    data: {
      attempt: result.attempt,
      responses: result.responses
    }
  });
});

export const getAttemptById = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const result = await attemptService.getAttemptById({
    attemptId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    data: {
      attempt: result.attempt,
      responses: result.responses
    }
  });
});


export const saveResponse = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const { questionId, studentAnswer } = req.body;

  const responseDoc = await attemptService.saveResponse({
    attemptId,
    questionId,
    studentAnswer,
    studentId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Question answer saved successfully',
    data: {
      response: responseDoc
    }
  });
});

export const submitAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const result = await attemptService.submitAttempt({
    attemptId,
    studentId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Assessment attempt submitted successfully',
    data: {
      attempt: result.attempt,
      responsesCount: result.responsesCount
    }
  });
});

export const getAssessmentAttempts = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const attempts = await attemptService.getAssessmentAttempts({
    assessmentId,
    teacherId: req.user._id
  });

  res.status(200).json({
    success: true,
    count: attempts.length,
    data: {
      attempts
    }
  });
});

