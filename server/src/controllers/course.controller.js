import { courseService } from '../services/course.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(req.user._id, req.body);
  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: {
      course
    }
  });
});

export const getCourses = asyncHandler(async (req, res) => {
  const courses = await courseService.getTeacherCourses(req.user._id);
  res.status(200).json({
    success: true,
    count: courses.length,
    data: {
      courses
    }
  });
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: {
      course
    }
  });
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(req.params.id, req.user._id, req.body);
  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: {
      course
    }
  });
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const result = await courseService.deleteCourse(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    message: result.message
  });
});
