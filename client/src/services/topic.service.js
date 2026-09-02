import { apiClient } from './api.js';

export const topicService = {
  async getTopics(courseId) {
    const res = await apiClient(`/courses/${courseId}/topics`, { method: 'GET' });
    return res.data?.topics || [];
  },

  async createTopic(courseId, topicData) {
    const res = await apiClient(`/courses/${courseId}/topics`, {
      method: 'POST',
      body: JSON.stringify(topicData)
    });
    return res.data?.topic;
  },

  async updateTopic(id, topicData) {
    const res = await apiClient(`/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(topicData)
    });
    return res.data?.topic;
  },

  async deleteTopic(id) {
    const res = await apiClient(`/topics/${id}`, { method: 'DELETE' });
    return res;
  }
};
