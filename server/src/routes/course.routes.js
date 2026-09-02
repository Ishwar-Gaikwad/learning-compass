import { Router } from 'express';
import {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse
} from '../controllers/course.controller.js';
import {
  createTopic,
  getTopics
} from '../controllers/topic.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';
import {
  validateCourseInput,
  validateUpdateCourseInput,
  validateTopicInput
} from '../middleware/validate.middleware.js';

const router = Router();

// Protect all course routes & authorize teacher role
router.use(protect);
router.use(authorizeRoles('teacher'));

router.route('/')
  .post(validateCourseInput, createCourse)
  .get(getCourses);

router.route('/:id')
  .get(getCourse)
  .patch(validateUpdateCourseInput, updateCourse)
  .put(validateUpdateCourseInput, updateCourse)
  .delete(deleteCourse);

// Nested Topic endpoints under Course
router.route('/:courseId/topics')
  .post(validateTopicInput, createTopic)
  .get(getTopics);

export default router;
