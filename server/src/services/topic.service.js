import { Topic } from '../models/Topic.js';
import { courseService } from './course.service.js';
import { AppError } from '../utils/AppError.js';

export const topicService = {
  async createTopic(courseId, teacherId, topicData) {
    // Verifies course existence and teacher ownership
    const course = await courseService.getCourseById(courseId, teacherId);

    const topic = await Topic.create({
      courseId: course._id,
      title: topicData.title.trim(),
      description: topicData.description ? topicData.description.trim() : '',
      order: topicData.order || 1,
      learningObjectives: topicData.learningObjectives || []
    });

    return topic;
  },

  async getTopicsByCourse(courseId, teacherId) {
    // Verifies course existence and teacher ownership
    const course = await courseService.getCourseById(courseId, teacherId);

    const topics = await Topic.find({ courseId: course._id }).sort({ order: 1, createdAt: 1 });
    return topics;
  },

  async getTopicById(topicId, teacherId) {
    const topic = await Topic.findById(topicId);

    if (!topic) {
      throw new AppError('Topic not found.', 404, 'TOPIC_NOT_FOUND');
    }

    // Verifies parent course ownership for the requesting teacher
    await courseService.getCourseById(topic.courseId, teacherId);

    return topic;
  },

  async updateTopic(topicId, teacherId, updateData) {
    const topic = await this.getTopicById(topicId, teacherId);

    if (updateData.title) topic.title = updateData.title.trim();
    if (updateData.description !== undefined) topic.description = updateData.description.trim();
    if (updateData.order !== undefined) topic.order = updateData.order;
    if (updateData.learningObjectives !== undefined) topic.learningObjectives = updateData.learningObjectives;

    await topic.save();
    return topic;
  },

  async deleteTopic(topicId, teacherId) {
    const topic = await this.getTopicById(topicId, teacherId);

    await Topic.findByIdAndDelete(topic._id);

    return { message: 'Topic deleted successfully' };
  }
};
