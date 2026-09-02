import { assessmentService } from '../services/assessment.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const generateAssessment = asyncHandler(async (req, res) => {
  const { courseId, topicId } = req.params;
  const { title, totalQuestions, difficulty, questionTypes, additionalInstructions } = req.body;

  const result = await assessmentService.generateAssessment({
    courseId,
    topicId,
    teacherId: req.user._id,
    title,
    totalQuestions: totalQuestions ? parseInt(totalQuestions, 10) : undefined,
    difficulty,
    questionTypes,
    additionalInstructions
  });

  res.status(201).json({
    success: true,
    message: 'Assessment generated successfully and grounded in learning materials',
    data: {
      assessment: result.assessment,
      retrievedChunksCount: result.retrievedChunksCount,
      sourceMaterialsCount: result.sourceMaterialsCount
    }
  });
});

export const getAssessmentById = asyncHandler(async (req, res) => {
  const assessment = await assessmentService.getAssessmentById(req.params.id, req.user._id);

  res.status(200).json({
    success: true,
    data: {
      assessment
    }
  });
});

export const getAssessmentsByTopic = asyncHandler(async (req, res) => {
  const { courseId, topicId } = req.params;
  const assessments = await assessmentService.getAssessmentsByTopic(courseId, topicId, req.user._id);

  res.status(200).json({
    success: true,
    count: assessments.length,
    data: {
      assessments
    }
  });
});

export const getStudentAssessments = asyncHandler(async (req, res) => {
  const assessments = await assessmentService.getAvailableStudentAssessments(req.user._id);

  res.status(200).json({
    success: true,
    count: assessments.length,
    data: {
      assessments
    }
  });
});

export const joinAssessment = asyncHandler(async (req, res) => {
  const { accessCode } = req.body;

  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Only students can join assessments via access code.',
      errorCode: 'FORBIDDEN'
    });
  }

  const result = await assessmentService.joinAssessmentByCode({
    accessCode,
    studentId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      assignment: result.assignment,
      assessment: result.assessment,
      accessCode: result.accessCode,
      isExisting: result.isExisting
    }
  });
});

