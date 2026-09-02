import { Router } from 'express';
import {
  generateLearningPath,
  getLearningPath,
  getStudentLearningPaths,
  getLearningPathById,
  completeLearningNode
} from '../controllers/learningPath.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';

const router = Router({ mergeParams: true });

// Protect all learning path endpoints
router.use(protect);

router.get('/student/learning-paths', authorizeRoles('student'), getStudentLearningPaths);
router.get('/learning-paths/:pathId', getLearningPathById);
router.post('/learning-paths/:pathId/nodes/:nodeId/complete', authorizeRoles('student'), completeLearningNode);

router.route('/diagnostic-reports/:reportId/learning-path')
  .post(generateLearningPath)
  .get(getLearningPath);

export default router;

