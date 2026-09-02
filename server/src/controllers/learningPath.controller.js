import { learningPathService } from '../services/learningPath.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateLearningPath = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const result = await learningPathService.generateLearningPath({
    diagnosticReportId: reportId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(201).json({
    success: true,
    message: 'Personalized learning path generated successfully',
    data: {
      learningPath: result.learningPath,
      targetConceptsCount: result.targetConceptsCount,
      ragChunksCount: result.ragChunksCount
    }
  });
});

export const getLearningPath = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const pathDoc = await learningPathService.getLearningPath({
    diagnosticReportId: reportId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    data: {
      learningPath: pathDoc
    }
  });
});

export const getStudentLearningPaths = asyncHandler(async (req, res) => {
  const paths = await learningPathService.getStudentLearningPaths(req.user._id);

  res.status(200).json({
    success: true,
    count: paths.length,
    data: {
      learningPaths: paths
    }
  });
});

export const getLearningPathById = asyncHandler(async (req, res) => {
  const { pathId } = req.params;

  const pathDoc = await learningPathService.getLearningPathById({
    pathId,
    userId: req.user._id,
    userRole: req.user.role
  });

  res.status(200).json({
    success: true,
    data: {
      learningPath: pathDoc
    }
  });
});

export const completeLearningNode = asyncHandler(async (req, res) => {
  const { pathId, nodeId } = req.params;

  const pathDoc = await learningPathService.completeLearningNode({
    pathId,
    nodeId,
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Learning node completion status updated',
    data: {
      learningPath: pathDoc
    }
  });
});

