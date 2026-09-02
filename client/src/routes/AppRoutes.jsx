import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TeacherDashboardPage } from '../pages/TeacherDashboardPage';
import { TeacherDiagnosticReportPage } from '../pages/TeacherDiagnosticReportPage';
import { StudentDashboardPage } from '../pages/StudentDashboardPage';
import { StudentAssessmentListPage } from '../pages/StudentAssessmentListPage';
import { StudentAssessmentPage } from '../pages/StudentAssessmentPage';
import { StudentLearningPathListPage } from '../pages/StudentLearningPathListPage';
import { StudentLearningPathDetailPage } from '../pages/StudentLearningPathDetailPage';
import { StudentReassessmentPlayerPage } from '../pages/StudentReassessmentPlayerPage';
import { ReassessmentComparisonPage } from '../pages/ReassessmentComparisonPage';
import { StudentProgressPage } from '../pages/StudentProgressPage';
import { ProfilePage } from '../pages/ProfilePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PublicOnlyRoute } from '../components/PublicOnlyRoute';
import { useAuth } from '../hooks/useAuth';

const DashboardRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }
  return <Navigate to="/student/dashboard" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages with Main Layout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      {/* Guest Only Pages (Redirects authenticated users away from Login/Register) */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      {/* Authenticated Dashboard Smart Redirect */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardRedirect />} />
        </Route>
      </Route>

      {/* Teacher Protected Dashboard Routes */}
      <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
        <Route element={<MainLayout />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboardPage />} />
          <Route path="/teacher/attempts/:attemptId/report" element={<TeacherDiagnosticReportPage />} />
          <Route path="/teacher/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Student Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route element={<MainLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/assessments" element={<StudentAssessmentListPage />} />
          <Route path="/student/assessments/:assessmentId" element={<StudentAssessmentPage />} />
          <Route path="/student/learning-paths" element={<StudentLearningPathListPage />} />
          <Route path="/student/learning-paths/:pathId" element={<StudentLearningPathDetailPage />} />
          <Route path="/student/progress" element={<StudentProgressPage />} />
          <Route path="/student/profile" element={<ProfilePage />} />
          <Route path="/student/reassessments/:assessmentId" element={<StudentReassessmentPlayerPage />} />
          <Route path="/student/reassessments/attempt/:attemptId/comparison" element={<ReassessmentComparisonPage />} />
        </Route>
      </Route>

      {/* 404 Catch All */}
      <Route element={<MainLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};


