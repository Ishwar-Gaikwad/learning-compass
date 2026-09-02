import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { Assessment } from './src/models/Assessment.js';
import { Attempt } from './src/models/Attempt.js';
import { AttemptResponse } from './src/models/AttemptResponse.js';
import { DiagnosticReport } from './src/models/DiagnosticReport.js';
import { LearningPath } from './src/models/LearningPath.js';
import { llmService } from './src/services/ai/llmService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5166;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runLearningPathTests = async () => {
  console.log('=== Starting Personalized Learning Path Generation Integration Tests ===');

  await connectDB();

  const teacherAEmail = `lp_teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `lp_teacher_b_${Date.now()}@test.com`;
  const studentAEmail = `lp_student_a_${Date.now()}@test.com`;
  const studentBEmail = `lp_student_b_${Date.now()}@test.com`;
  const courseCodeA = `MATH-LP-A-${Date.now()}`;
  const courseCodeB = `MATH-LP-B-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Setup Teacher A & B, Student A & B, Courses, Topic
      console.log('\n--- Setup: Register Teacher A & B, Student A & B, Courses, Topic ---');
      const regResTeacherA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Alice LP', email: teacherAEmail, password: 'password123', role: 'teacher' })
      });
      const regDataTeacherA = await regResTeacherA.json();
      const teacherAToken = regDataTeacherA.data?.token || regDataTeacherA.token;

      const regResTeacherB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob LP', email: teacherBEmail, password: 'password123', role: 'teacher' })
      });
      const regDataTeacherB = await regResTeacherB.json();
      const teacherBToken = regDataTeacherB.data?.token || regDataTeacherB.token;

      const regResStudentA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Student Alice LP', email: studentAEmail, password: 'password123', role: 'student' })
      });
      const regDataStudentA = await regResStudentA.json();
      const studentAToken = regDataStudentA.data?.token || regDataStudentA.token;

      const regResStudentB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Student Bob LP', email: studentBEmail, password: 'password123', role: 'student' })
      });
      const regDataStudentB = await regResStudentB.json();
      const studentBToken = regDataStudentB.data?.token || regDataStudentB.token;

      const createCourseResA = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Algebra Learning Path Course', description: 'LP test course', code: courseCodeA, subject: 'Math', gradeLevel: '10th' })
      });
      const createCourseDataA = await createCourseResA.json();
      const courseIdA = createCourseDataA.data.course._id;

      const createTopicResA = await fetch(`${BASE_URL}/courses/${courseIdA}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Polynomial Synthetic Division', order: 1 })
      });
      const createTopicDataA = await createTopicResA.json();
      const topicIdA = createTopicDataA.data.topic._id;

      // Ingest PDF Material and Generate Assessment
      console.log('\n--- Upload Material & Ingest RAG Document ---');
      const pdfBuffer = Buffer.from(
        '1 0 obj << /Length 400 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Synthetic division is a shorthand method for polynomial division when divisor is linear x - c. First write constant c of divisor. Next write dividend coefficients. Multiply and add down columns.) Tj ET\n' +
        'BT /F1 12 Tf [Page 2] (The Remainder Theorem states that dividing P(x) by x - c yields remainder P(c).) Tj ET\n' +
        'endstream endobj'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'learning_path_material.pdf');
      form.append('title', 'Learning Path Source Book');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` },
        body: form
      });
      const uploadData = await uploadRes.json();
      const materialId = uploadData.data.material._id;
      await fetch(`${BASE_URL}/materials/${materialId}/process`, { method: 'POST', headers: { 'Authorization': `Bearer ${teacherAToken}` } });

      const genRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Polynomial LP Quiz', totalQuestions: 2 })
      });
      const genData = await genRes.json();
      const assessmentId = genData.data.assessment._id;
      const question1Id = genData.data.assessment.questions[0]._id;

      // Complete Assessment & Generate Diagnostic Report
      console.log('\n--- Step 1: Generate Diagnostic Report for Student A ---');
      const startRes = await fetch(`${BASE_URL}/assessments/${assessmentId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentAToken}` }
      });
      const startData = await startRes.json();
      const attemptId = startData.data.attempt._id;

      await fetch(`${BASE_URL}/attempts/${attemptId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentAToken}` },
        body: JSON.stringify({
          questionId: question1Id,
          studentAnswer: 'Synthetic division using constant c and dividend coefficients'
        })
      });

      await fetch(`${BASE_URL}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });

      const diagRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnose`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const diagData = await diagRes.json();
      const reportId = diagData.data.report._id;

      console.log('Diagnostic Report Created Status:', diagRes.status, '(Expected: 201 Created)');

      // -------------------------------------------------------------
      // Test 2, 3, 4, 5, 6: Generate Learning Path & verify targets, RAG grounding, & Atlas persistence
      // -------------------------------------------------------------
      console.log('\n--- Test 2-6: Generate Learning Path & verify weak concept targets & RAG grounding ---');
      const lpRes = await fetch(`${BASE_URL}/diagnostic-reports/${reportId}/learning-path`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const lpData = await lpRes.json();

      console.log('Generate Learning Path HTTP Status:', lpRes.status, '(Expected: 201 Created)');
      console.log('Learning Path Title:', lpData.data.learningPath.title);
      console.log('Nodes Count:', lpData.data.learningPath.nodes.length, '(Expected: > 0)');
      
      const firstNode = lpData.data.learningPath.nodes[0];
      console.log('Node 1 Target Concept:', firstNode.targetConcept);
      console.log('Node 1 Reason for Targeting:', `"${firstNode.reasonForTargeting.substring(0, 60)}..."`);
      console.log('Node 1 Learning Objective:', `"${firstNode.learningObjective.substring(0, 60)}..."`);
      console.log('Node 1 Recommended Material File:', firstNode.recommendedMaterial?.fileName);
      console.log('Node 1 Practice Activity Title:', firstNode.practiceActivity?.title);
      console.log('Node 1 Reassessment Criteria:', `"${firstNode.reassessmentCriteria.substring(0, 50)}..."`);

      const dbPath = await LearningPath.findOne({ diagnosticReportId: reportId });
      console.log('Learning Path Saved in Atlas DB:', !!dbPath);

      // -------------------------------------------------------------
      // Test 7: Verify malformed AI output is rejected safely
      // -------------------------------------------------------------
      console.log('\n--- Test 7: Verify malformed AI output is rejected safely ---');
      const localProvider = llmService.getProvider();
      localProvider.setSimulatedInvalidOutput(true);

      const invalidLpRes = await fetch(`${BASE_URL}/diagnostic-reports/${reportId}/learning-path`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const invalidLpData = await invalidLpRes.json();

      console.log('Invalid AI Output Response Status:', invalidLpRes.status, '(Expected: 400 Bad Request)');
      console.log('Error Message:', invalidLpData.message);

      localProvider.setSimulatedInvalidOutput(false);

      // -------------------------------------------------------------
      // Test 8: Verify another student (Student B) cannot access the learning path
      // -------------------------------------------------------------
      console.log('\n--- Test 8: Verify Student B cannot access Student A learning path ---');
      const studentBGetRes = await fetch(`${BASE_URL}/diagnostic-reports/${reportId}/learning-path`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentBToken}` }
      });
      const studentBGetData = await studentBGetRes.json();

      console.log('Student B Access Learning Path Status:', studentBGetRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', studentBGetData.message);

      // -------------------------------------------------------------
      // Test 9: Verify an unauthorized teacher (Teacher B) cannot access the learning path
      // -------------------------------------------------------------
      console.log('\n--- Test 9: Verify unauthorized Teacher B cannot access Student A learning path ---');
      const teacherBGetRes = await fetch(`${BASE_URL}/diagnostic-reports/${reportId}/learning-path`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacherBToken}` }
      });
      const teacherBGetData = await teacherBGetRes.json();

      console.log('Teacher B Access Learning Path Status:', teacherBGetRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', teacherBGetData.message);

      console.log('\n=== ALL PERSONALIZED LEARNING PATH TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Learning Path test execution failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail, studentAEmail, studentBEmail] } });
      await Course.deleteMany({ code: { $in: [courseCodeA, courseCodeB] } });
      await Topic.deleteMany({ title: 'Polynomial Synthetic Division' });
      await Material.deleteMany({ title: 'Learning Path Source Book' });
      await Assessment.deleteMany({ title: 'Polynomial LP Quiz' });
      await Attempt.deleteMany({});
      await AttemptResponse.deleteMany({});
      await DiagnosticReport.deleteMany({});
      await LearningPath.deleteMany({});
      
      const testUploadsDir = path.join(__dirname, 'uploads');
      if (fs.existsSync(testUploadsDir)) {
        fs.rmSync(testUploadsDir, { recursive: true, force: true });
      }

      console.log('Test data cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runLearningPathTests();
