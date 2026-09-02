import { Router } from 'express';
import {
  uploadMaterial,
  processMaterial,
  getMaterialStatus,
  getMaterialsByTopic
} from '../controllers/material.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';
import { uploadSingleFile } from '../middleware/upload.middleware.js';

const router = Router({ mergeParams: true });

// Protect all routes and enforce teacher role
router.use(protect);
router.use(authorizeRoles('teacher'));

// Upload material to topic & get materials for topic
router.route('/courses/:courseId/topics/:topicId/materials')
  .post(uploadSingleFile, uploadMaterial)
  .get(getMaterialsByTopic);

// Process document endpoint
router.route('/materials/:id/process')
  .post(processMaterial);

// Status route by material ID
router.route('/materials/:id/status')
  .get(getMaterialStatus);

export default router;
