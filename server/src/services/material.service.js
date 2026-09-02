import { Material } from '../models/Material.js';
import { courseService } from './course.service.js';
import { topicService } from './topic.service.js';
import { storageService } from './storage/storageService.js';
import { AppError } from '../utils/AppError.js';

export const materialService = {
  async uploadMaterial({ courseId, topicId, teacherId, file, title }) {
    // 1. Enforce teacher ownership of Course and Topic
    await courseService.getCourseById(courseId, teacherId);
    const topic = await topicService.getTopicById(topicId, teacherId);

    if (topic.courseId.toString() !== courseId.toString()) {
      throw new AppError('Topic does not belong to the specified course.', 400, 'INVALID_TOPIC_COURSE_RELATION');
    }

    if (!file || !file.buffer) {
      throw new AppError('File buffer is required for upload.', 400, 'MISSING_FILE');
    }

    // 2. Delegate file storage to storage abstraction
    const storageResult = await storageService.saveFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      teacherId
    });

    const materialTitle = title && title.trim().length > 0 ? title.trim() : file.originalname;

    // 3. Create Material record in MongoDB Atlas
    const material = await Material.create({
      teacherId,
      courseId,
      topicId,
      title: materialTitle,
      originalFileName: file.originalname,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      fileType: file.fileType,
      fileUrl: storageResult.fileUrl,
      storageKey: storageResult.storageKey,
      status: 'uploaded',
      extractedTextMetadata: {
        characterCount: 0,
        wordCount: 0,
        ocrExecuted: false,
        totalChunksCount: 0
      }
    });

    return material;
  },

  async getMaterialStatus(materialId, teacherId) {
    const material = await Material.findById(materialId);

    if (!material) {
      throw new AppError('Material document not found.', 404, 'MATERIAL_NOT_FOUND');
    }

    if (material.teacherId.toString() !== teacherId.toString()) {
      throw new AppError('Access denied. You do not own this material.', 403, 'FORBIDDEN');
    }

    return {
      materialId: material._id,
      status: material.status,
      ocrExecuted: material.extractedTextMetadata?.ocrExecuted || false,
      totalChunksCount: material.extractedTextMetadata?.totalChunksCount || 0,
      material
    };
  },

  async getMaterialsByTopic(courseId, topicId, teacherId) {
    const topic = await topicService.getTopicById(topicId, teacherId);

    if (topic.courseId.toString() !== courseId.toString()) {
      throw new AppError('Topic does not belong to the specified course.', 400, 'INVALID_TOPIC_COURSE_RELATION');
    }

    const materials = await Material.find({ topicId, teacherId }).sort({ createdAt: -1 });
    return materials;
  }
};
