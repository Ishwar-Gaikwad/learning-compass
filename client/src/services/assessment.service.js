import { apiClient } from './api.js';

export const assessmentService = {
  async generateAssessment(courseId, topicId, config) {
    const res = await apiClient(`/courses/${courseId}/topics/${topicId}/assessments/generate`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    return res.data;
  },

  async getAssessmentsByTopic(courseId, topicId) {
    const res = await apiClient(`/courses/${courseId}/topics/${topicId}/assessments`, {
      method: 'GET'
    });
    return res.data?.assessments || [];
  },

  async getAssessmentById(id) {
    const res = await apiClient(`/assessments/${id}`, {
      method: 'GET'
    });
    return res.data?.assessment;
  },

  async getStudentAssessments() {
    const res = await apiClient('/student/assessments', {
      method: 'GET'
    });
    return res.data?.assessments || [];
  },

  async joinAssessment(accessCode) {
    const res = await apiClient('/assessments/join', {
      method: 'POST',
      body: JSON.stringify({ accessCode })
    });
    return res.data;
  }
};

