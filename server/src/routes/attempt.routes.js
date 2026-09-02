import { Router } from 'express';
import {
  startAttempt,
  getCurrentAttempt,
  getAttemptById,
  getAssessmentAttempts,
  saveResponse,
  submitAttempt
} from '../controllers/attempt.controller.js';
import {
  evaluateResponse,
  evaluateAttempt
} from '../controllers/evaluation.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router({ mergeParams: true });

// Teacher assessment attempts route
router.get('/assessments/:assessmentId/attempts', protect, authorizeRoles('teacher'), getAssessmentAttempts);

// Student assessment attempt session routes (student role authorized)
router.post('/assessments/:assessmentId/attempts', protect, authorizeRoles('student'), startAttempt);
router.get('/assessments/:assessmentId/attempts/current', protect, authorizeRoles('student'), getCurrentAttempt);
router.get('/attempts/:attemptId', protect, getAttemptById);
router.post('/attempts/:attemptId/responses', protect, authorizeRoles('student'), saveResponse);
router.post('/attempts/:attemptId/submit', protect, authorizeRoles('student'), submitAttempt);

// Response & Attempt evaluation routes (authenticated students or teachers)
router.post('/attempts/:attemptId/responses/:responseId/evaluate', protect, evaluateResponse);
router.post('/attempts/:attemptId/evaluate', protect, evaluateAttempt);

export default router;


