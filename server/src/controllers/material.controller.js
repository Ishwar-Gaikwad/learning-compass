import { materialService } from '../services/material.service.js';
import { documentIngestionService } from '../services/documents/documentIngestionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const uploadMaterial = asyncHandler(async (req, res) => {
  const { courseId, topicId } = req.params;
  const { title } = req.body;

  const material = await materialService.uploadMaterial({
    courseId,
    topicId,
    teacherId: req.user._id,
    file: req.file,
    title
  });

  res.status(202).json({
    success: true,
    message: 'Material uploaded successfully and queued for processing',
    data: {
      material
    }
  });
});

export const processMaterial = asyncHandler(async (req, res) => {
  const result = await documentIngestionService.processMaterialDocument(req.params.id, req.user._id);

  res.status(200).json({
    success: true,
    message: 'Document processing executed successfully',
    data: {
      material: result.material,
      chunksCount: result.chunksCount,
      chunks: result.chunks
    }
  });
});

export const getMaterialStatus = asyncHandler(async (req, res) => {
  const statusData = await materialService.getMaterialStatus(req.params.id, req.user._id);

  res.status(200).json({
    success: true,
    data: statusData
  });
});

export const getMaterialsByTopic = asyncHandler(async (req, res) => {
  const { courseId, topicId } = req.params;
  const materials = await materialService.getMaterialsByTopic(courseId, topicId, req.user._id);

  res.status(200).json({
    success: true,
    count: materials.length,
    data: {
      materials
    }
  });
});
