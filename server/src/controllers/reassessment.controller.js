import { reassessmentService } from '../services/reassessment.service.js';
import { comparisonService } from '../services/comparison.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateReassessment = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const result = await reassessmentService.generateReassessment({
    diagnosticReportId: reportId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(201).json({
    success: true,
    message: 'Targeted reassessment generated successfully',
    data: {
      reassessment: result.reassessment,
      targetedConcepts: result.targetedConcepts,
      previousDiagnosticReportId: result.previousDiagnosticReportId
    }
  });
});

export const processReassessment = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const result = await reassessmentService.processReassessmentSubmission({
    reassessmentAttemptId: attemptId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    message: 'Reassessment processed successfully and diagnostic comparison created',
    data: {
      attempt: result.attempt,
      newDiagnosticReport: result.newDiagnosticReport,
      comparison: result.comparison
    }
  });
});

export const getReassessmentComparison = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const comparisonDoc = await comparisonService.getComparisonByAttemptId(
    attemptId,
    req.user._id,
    req.user.role
  );

  res.status(200).json({
    success: true,
    data: {
      comparison: comparisonDoc
    }
  });
});
