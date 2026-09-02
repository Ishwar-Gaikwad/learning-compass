import { Router } from 'express';
import {
  getTopic,
  updateTopic,
  deleteTopic
} from '../controllers/topic.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';
import { validateUpdateTopicInput } from '../middleware/validate.middleware.js';

const router = Router();

// Protect all topic routes & authorize teacher role
router.use(protect);
router.use(authorizeRoles('teacher'));

router.route('/:id')
  .get(getTopic)
  .patch(validateUpdateTopicInput, updateTopic)
  .put(validateUpdateTopicInput, updateTopic)
  .delete(deleteTopic);

export default router;
