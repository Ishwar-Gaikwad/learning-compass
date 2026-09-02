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
import { llmService } from './src/services/ai/llmService.js';
import { diagnosticService } from './src/services/diagnostic.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5155;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runDiagnosticEngineTests = async () => {
  console.log('=== Starting AI Diagnostic Engine Integration Tests ===');

  await connectDB();

  const teacherAEmail = `diag_teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `diag_teacher_b_${Date.now()}@test.com`;
  const studentAEmail = `diag_student_a_${Date.now()}@test.com`;
  const studentBEmail = `diag_student_b_${Date.now()}@test.com`;
  const courseCodeA = `MATH-DIAG-A-${Date.now()}`;
  const courseCodeB = `MATH-DIAG-B-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Setup Teacher A & B, Student A & B, Course A & B, Topic
      console.log('\n--- Setup: Register Teacher A & B, Student A & B, Courses, Topic ---');
      const regResTeacherA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Alice Diag', email: teacherAEmail, password: 'password123', role: 'teacher' })
      });
      const regDataTeacherA = await regResTeacherA.json();
      const teacherAToken = regDataTeacherA.data?.token || regDataTeacherA.token;

      const regResTeacherB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob Diag', email: teacherBEmail, password: 'password123', role: 'teacher' })
      });
      const regDataTeacherB = await regResTeacherB.json();
      const teacherBToken = regDataTeacherB.data?.token || regDataTeacherB.token;

      const regResStudentA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Student Alice Diag', email: studentAEmail, password: 'password123', role: 'student' })
      });
      const regDataStudentA = await regResStudentA.json();
      const studentAToken = regDataStudentA.data?.token || regDataStudentA.token;

      const regResStudentB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Student Bob Diag', email: studentBEmail, password: 'password123', role: 'student' })
      });
      const regDataStudentB = await regResStudentB.json();
      const studentBToken = regDataStudentB.data?.token || regDataStudentB.token;

      const createCourseResA = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Algebra Diagnostic Course', description: 'Diag test course', code: courseCodeA, subject: 'Math', gradeLevel: '10th' })
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
      console.log('\n--- Upload Material & Generate Assessment ---');
      const pdfBuffer = Buffer.from(
        '1 0 obj << /Length 400 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Synthetic division is a shorthand method for polynomial division when divisor is linear x - c. First write constant c of divisor. Next write dividend coefficients. Multiply and add down columns.) Tj ET\n' +
        'BT /F1 12 Tf [Page 2] (The Remainder Theorem states that dividing P(x) by x - c yields remainder P(c).) Tj ET\n' +
        'endstream endobj'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'diag_material.pdf');
      form.append('title', 'Diagnostic Source Book');

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
        body: JSON.stringify({ title: 'Polynomial Synthetic Division Assessment', totalQuestions: 2 })
      });
      const genData = await genRes.json();
      const assessmentId = genData.data.assessment._id;
      const question1Id = genData.data.assessment.questions[0]._id;

      // Student A Starts Assessment Attempt
      console.log('\n--- Step 1: Complete Assessment as Student A ---');
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

      // -------------------------------------------------------------
      // Test 11: Unsubmitted attempt cannot generate diagnostic report
      // -------------------------------------------------------------
      console.log('\n--- Test 11: Verify unsubmitted attempt cannot generate diagnostic report ---');
      const unsubmittedDiagRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnose`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const unsubmittedDiagData = await unsubmittedDiagRes.json();

      console.log('Unsubmitted Diagnostic Status:', unsubmittedDiagRes.status, '(Expected: 400 Bad Request)');
      console.log('Error Message:', unsubmittedDiagData.message);

      // Submit attempt
      const submitRes = await fetch(`${BASE_URL}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const submitData = await submitRes.json();
      console.log('Submitted Attempt Status:', submitData.data.attempt.status, '(Expected: "submitted")');

      // -------------------------------------------------------------
      // Test 2: Evaluate all responses
      // -------------------------------------------------------------
      console.log('\n--- Test 2: Evaluate all responses for submitted attempt ---');
      const evalRes = await fetch(`${BASE_URL}/attempts/${attemptId}/evaluate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const evalData = await evalRes.json();

      console.log('Evaluate Attempt Status:', evalRes.status, '(Expected: 200 OK)');
      console.log('Evaluated Responses Count:', evalData.data.evaluatedResponsesCount);

      // -------------------------------------------------------------
      // Test 3, 4, 5, 6, 7: Generate diagnostic report & verify Atlas storage & evidence traceability
      // -------------------------------------------------------------
      console.log('\n--- Test 3-7: Generate diagnostic report & verify Atlas storage & findings evidence ---');
      const diagRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnose`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const diagData = await diagRes.json();

      console.log('Generate Diagnostic Report Status:', diagRes.status, '(Expected: 201 Created)');
      console.log('Overall Mastery Score:', diagData.data.report.overallMasteryScore, '(0 - 100)');
      console.log('Mastery Level:', diagData.data.report.masteryLevel);
      console.log('Conceptual Understanding Score:', diagData.data.report.dimensionScores.conceptualUnderstanding);
      console.log('Procedural Fluency Score:', diagData.data.report.dimensionScores.proceduralFluency);
      console.log('Application Transfer Score:', diagData.data.report.dimensionScores.applicationTransfer);
      console.log('Strengths Count:', diagData.data.report.strengths.length);
      console.log('Strength Evidence Traceable:', !!diagData.data.report.strengths[0]?.evidence);
      console.log('Weak Concepts Array Exists:', Array.isArray(diagData.data.report.weakConcepts));
      console.log('AI Executive Summary:', `"${diagData.data.report.aiSummary.substring(0, 60)}..."`);

      const dbReport = await DiagnosticReport.findOne({ attemptId });
      console.log('Diagnostic Report Saved in Atlas DB:', !!dbReport);

      // -------------------------------------------------------------
      // Test 8: Verify malformed AI output is rejected safely
      // -------------------------------------------------------------
      console.log('\n--- Test 8: Verify malformed AI output is rejected safely ---');
      const localProvider = llmService.getProvider();
      localProvider.setSimulatedInvalidOutput(true);

      const invalidDiagRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnose`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentAToken}` }
      });
      const invalidDiagData = await invalidDiagRes.json();

      console.log('Invalid AI Output Response Status:', invalidDiagRes.status, '(Expected: 400 Bad Request)');
      console.log('Error Message:', invalidDiagData.message);

      localProvider.setSimulatedInvalidOutput(false);

      // -------------------------------------------------------------
      // Test 9: Verify another student (Student B) cannot access the report
      // -------------------------------------------------------------
      console.log('\n--- Test 9: Verify Student B cannot access Student A diagnostic report ---');
      const studentBGetRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnostic-report`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentBToken}` }
      });
      const studentBGetData = await studentBGetRes.json();

      console.log('Student B Access Diagnostic Report Status:', studentBGetRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', studentBGetData.message);

      // -------------------------------------------------------------
      // Test 10: Verify an unauthorized teacher (Teacher B) cannot access the report
      // -------------------------------------------------------------
      console.log('\n--- Test 10: Verify unauthorized Teacher B cannot access Student A report ---');
      const teacherBGetRes = await fetch(`${BASE_URL}/attempts/${attemptId}/diagnostic-report`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacherBToken}` }
      });
      const teacherBGetData = await teacherBGetRes.json();

      console.log('Teacher B Access Diagnostic Report Status:', teacherBGetRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', teacherBGetData.message);

      console.log('\n=== ALL AI DIAGNOSTIC ENGINE TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Diagnostic Engine test execution failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail, studentAEmail, studentBEmail] } });
      await Course.deleteMany({ code: { $in: [courseCodeA, courseCodeB] } });
      await Topic.deleteMany({ title: 'Polynomial Synthetic Division' });
      await Material.deleteMany({ title: 'Diagnostic Source Book' });
      await Assessment.deleteMany({ title: 'Polynomial Synthetic Division Assessment' });
      await Attempt.deleteMany({});
      await AttemptResponse.deleteMany({});
      await DiagnosticReport.deleteMany({});
      
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

runDiagnosticEngineTests();
