import { topicService } from '../services/topic.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.createTopic(req.params.courseId, req.user._id, req.body);
  res.status(201).json({
    success: true,
    message: 'Topic created successfully',
    data: {
      topic
    }
  });
});

export const getTopics = asyncHandler(async (req, res) => {
  const topics = await topicService.getTopicsByCourse(req.params.courseId, req.user._id);
  res.status(200).json({
    success: true,
    count: topics.length,
    data: {
      topics
    }
  });
});

export const getTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.getTopicById(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: {
      topic
    }
  });
});

export const updateTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.updateTopic(req.params.id, req.user._id, req.body);
  res.status(200).json({
    success: true,
    message: 'Topic updated successfully',
    data: {
      topic
    }
  });
});

export const deleteTopic = asyncHandler(async (req, res) => {
  const result = await topicService.deleteTopic(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    message: result.message
  });
});
