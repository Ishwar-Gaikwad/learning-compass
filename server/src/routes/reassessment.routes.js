import { Router } from 'express';
import {
  generateReassessment,
  processReassessment,
  getReassessmentComparison
} from '../controllers/reassessment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });

// Protect all reassessment endpoints
router.use(protect);

router.post('/diagnostic-reports/:reportId/reassessment', generateReassessment);
router.post('/attempts/:attemptId/process-reassessment', processReassessment);
router.get('/attempts/:attemptId/reassessment-comparison', getReassessmentComparison);

export default router;
