import { Router } from 'express';
import {
  generateAssessment,
  getAssessmentById,
  getAssessmentsByTopic,
  getStudentAssessments,
  joinAssessment
} from '../controllers/assessment.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router({ mergeParams: true });

// Student assessment routes
router.get('/student/assessments', protect, authorizeRoles('student'), getStudentAssessments);
router.post('/assessments/join', protect, authorizeRoles('student'), joinAssessment);
router.post('/join', protect, authorizeRoles('student'), joinAssessment);

// Teacher assessment routes (method-specific handlers)
router.post('/courses/:courseId/topics/:topicId/assessments/generate', protect, authorizeRoles('teacher'), generateAssessment);
router.post('/courses/:courseId/topics/:topicId/assessments', protect, authorizeRoles('teacher'), generateAssessment);
router.get('/courses/:courseId/topics/:topicId/assessments', protect, authorizeRoles('teacher'), getAssessmentsByTopic);
router.get('/assessments/:id', protect, authorizeRoles('teacher'), getAssessmentById);

export default router;

