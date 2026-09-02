import { diagnosticService } from '../services/diagnostic.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateDiagnosticReport = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const result = await diagnosticService.generateDiagnosticReport({
    attemptId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(201).json({
    success: true,
    message: 'Diagnostic report generated successfully',
    data: {
      report: result.report,
      evaluatedResponsesCount: result.evaluatedResponsesCount
    }
  });
});

export const getDiagnosticReport = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;

  const report = await diagnosticService.getDiagnosticReport({
    attemptId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    data: {
      report
    }
  });
});
