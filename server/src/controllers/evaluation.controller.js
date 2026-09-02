import { evaluationService } from '../services/evaluation.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const evaluateResponse = asyncHandler(async (req, res) => {
  const { attemptId, responseId } = req.params;

  const result = await evaluationService.evaluateResponse({
    attemptId,
    responseId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    message: 'Response evaluated successfully',
    data: {
      response: result.response,
      evaluation: result.evaluation
    }
  });
});

export const evaluateAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const result = await evaluationService.evaluateAttempt({
    attemptId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    message: 'All attempt responses evaluated successfully',
    data: {
      attempt: result.attempt,
      evaluatedResponsesCount: result.evaluatedResponsesCount,
      responses: result.responses
    }
  });
});
