import { apiClient } from './api.js';

export const learningPathService = {
  async getStudentLearningPaths() {
    const res = await apiClient('/student/learning-paths', {
      method: 'GET'
    });
    return res.data?.learningPaths || [];
  },

  async getLearningPathById(pathId) {
    const res = await apiClient(`/learning-paths/${pathId}`, {
      method: 'GET'
    });
    return res.data?.learningPath;
  },

  async getLearningPathByReportId(reportId) {
    const res = await apiClient(`/diagnostic-reports/${reportId}/learning-path`, {
      method: 'GET'
    });
    return res.data?.learningPath;
  },

  async completeNode(pathId, nodeId) {
    const res = await apiClient(`/learning-paths/${pathId}/nodes/${nodeId}/complete`, {
      method: 'POST'
    });
    return res.data?.learningPath;
  }
};
