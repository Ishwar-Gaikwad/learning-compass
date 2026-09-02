import { Router } from 'express';
import {
  generateDiagnosticReport,
  getDiagnosticReport
} from '../controllers/diagnostic.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });

// Protect all diagnostic endpoints
router.use(protect);

router.route('/attempts/:attemptId/diagnose')
  .post(generateDiagnosticReport);

router.route('/attempts/:attemptId/diagnostic-report')
  .post(generateDiagnosticReport)
  .get(getDiagnosticReport);

export default router;
