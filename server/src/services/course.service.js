import { Course } from '../models/Course.js';
import { Topic } from '../models/Topic.js';
import { AppError } from '../utils/AppError.js';

export const courseService = {
  async createCourse(teacherId, courseData) {
    const existingCode = await Course.findOne({ code: courseData.code.trim().toUpperCase() });
    if (existingCode) {
      throw new AppError(`Course code '${courseData.code.toUpperCase()}' is already in use.`, 400, 'DUPLICATE_COURSE_CODE');
    }

    const course = await Course.create({
      ...courseData,
      title: courseData.title.trim(),
      description: courseData.description.trim(),
      code: courseData.code.trim().toUpperCase(),
      subject: courseData.subject.trim(),
      gradeLevel: courseData.gradeLevel.trim(),
      teacherId
    });

    return course;
  },

  async getTeacherCourses(teacherId) {
    const courses = await Course.find({ teacherId }).sort({ createdAt: -1 });
    return courses;
  },

  async getCourseById(courseId, teacherId) {
    const course = await Course.findById(courseId);

    if (!course) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }

    if (course.teacherId.toString() !== teacherId.toString()) {
      throw new AppError('Access denied. You do not own this course.', 403, 'FORBIDDEN');
    }

    return course;
  },

  async updateCourse(courseId, teacherId, updateData) {
    const course = await this.getCourseById(courseId, teacherId);

    if (updateData.code && updateData.code.trim().toUpperCase() !== course.code) {
      const existingCode = await Course.findOne({ code: updateData.code.trim().toUpperCase() });
      if (existingCode) {
        throw new AppError(`Course code '${updateData.code.toUpperCase()}' is already in use.`, 400, 'DUPLICATE_COURSE_CODE');
      }
      course.code = updateData.code.trim().toUpperCase();
    }

    if (updateData.title) course.title = updateData.title.trim();
    if (updateData.description) course.description = updateData.description.trim();
    if (updateData.subject) course.subject = updateData.subject.trim();
    if (updateData.gradeLevel) course.gradeLevel = updateData.gradeLevel.trim();
    if (updateData.status) course.status = updateData.status;

    await course.save();
    return course;
  },

  async deleteCourse(courseId, teacherId) {
    const course = await this.getCourseById(courseId, teacherId);

    // Delete all topics associated with this course
    await Topic.deleteMany({ courseId: course._id });

    // Delete the course
    await Course.findByIdAndDelete(course._id);

    return { message: 'Course and associated topics deleted successfully' };
  }
};
