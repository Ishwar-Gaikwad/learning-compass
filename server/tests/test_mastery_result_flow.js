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
import { AssessmentAssignment } from './src/models/AssessmentAssignment.js';
import { Attempt } from './src/models/Attempt.js';
import { AttemptResponse } from './src/models/AttemptResponse.js';
import { DiagnosticReport } from './src/models/DiagnosticReport.js';
import { LearningPath } from './src/models/LearningPath.js';
import { diagnosticService } from './src/services/diagnostic.service.js';
import { learningPathService } from './src/services/learningPath.service.js';
import { attemptService } from './src/services/attempt.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5142;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const logAssessmentResultFlow = (label, data) => {
  console.log(`\n[ASSESSMENT RESULT FLOW - ${label}]`);
  console.log(`assessmentId: ${data.assessmentId}`);
  console.log(`attemptId: ${data.attemptId}`);
  console.log(`studentId: ${data.studentId}`);
  console.log(`score: ${data.score}`);
  console.log(`mastered: ${data.mastered}`);
  console.log(`diagnosticReportId: ${data.diagnosticReportId}`);
  console.log(`learningPathId: ${data.learningPathId}`);
  console.log(`remediationTaskCount: ${data.remediationTaskCount}`);
  console.log(`studentResultAvailable: ${data.studentResultAvailable}`);
};

const runMasteryResultFlowTest = async () => {
  console.log('=== Starting Post-Assessment Submission Mastery Result Lifecycle Test ===');

  await connectDB();

  const teacherEmail = `mastery_teacher_${Date.now()}@test.com`;
  const studentEmail = `mastery_student_${Date.now()}@test.com`;
  const courseCode = `MASTERY-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // 1. Setup Teacher, Student, Course, Topic, Material
      console.log('\n--- Setup: Register Teacher & Student, Create Course & Topic ---');
      const regResT = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Mastery Teacher', email: teacherEmail, password: 'password123', role: 'teacher' })
      });
      const regDataT = await regResT.json();
      const teacherToken = regDataT.data?.token || regDataT.token;
      const teacherId = regDataT.data?.user?._id || regDataT.user?._id;

      const regResS = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Mastery Student', email: studentEmail, password: 'password123', role: 'student' })
      });
      const regDataS = await regResS.json();
      const studentToken = regDataS.data?.token || regDataS.token;
      const studentId = regDataS.data?.user?._id || regDataS.user?._id;

      const courseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
        body: JSON.stringify({ title: 'Mastery Test Course', description: 'Test course', code: courseCode, subject: 'CS', gradeLevel: '10th' })
      });
      const courseData = await courseRes.json();
      const courseId = courseData.data.course._id;

      const topicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
        body: JSON.stringify({ title: 'Stacks Data Structure Mastery', order: 1 })
      });
      const topicData = await topicRes.json();
      const topicId = topicData.data.topic._id;

      // Ingest PDF Material
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
        '4 0 obj << /Length 120 >> stream\n' +
        'BT /F1 12 Tf (A stack is a linear data structure following the LIFO Last In First Out principle. Push and pop operations operate at top.) Tj ET\n' +
        'endstream endobj\n' +
        'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n' +
        'trailer << /Size 5 /Root 1 0 R >>\nstartxref\n380\n%%EOF'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'stacks_mastery.pdf');
      form.append('title', 'Stacks Mastery Material');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherToken}` },
        body: form
      });
      const uploadData = await uploadRes.json();
      const materialId = uploadData.data.material._id;
      await fetch(`${BASE_URL}/materials/${materialId}/process`, { method: 'POST', headers: { 'Authorization': `Bearer ${teacherToken}` } });

      // Generate Assessment 1
      const genRes1 = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
        body: JSON.stringify({ title: 'Stacks Mastery Quiz', totalQuestions: 2, difficulty: 'easy' })
      });
      const genData1 = await genRes1.json();
      const assessment1 = genData1.data.assessment;
      const assessment1Id = assessment1._id;

      // =============================================================
      // SCENARIO A — ALL ANSWERS CORRECT (TOPIC MASTERED)
      // =============================================================
      console.log('\n==================================================');
      console.log(' SCENARIO A — ALL ANSWERS CORRECT (TOPIC MASTERED)');
      console.log('==================================================');

      await fetch(`${BASE_URL}/assessments/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ accessCode: assessment1.accessCode })
      });

      const startRes1 = await fetch(`${BASE_URL}/assessments/${assessment1Id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
      });
      const startData1 = await startRes1.json();
      const attempt1Id = (startData1.data?.attempt || startData1.attempt)._id;

      const q1Id = assessment1.questions[0]._id;
      const q2Id = assessment1.questions[1]._id;

      // Submit ALL 100% CORRECT answers
      await fetch(`${BASE_URL}/attempts/${attempt1Id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ questionId: q1Id, studentAnswer: 'Stack operates strictly on LIFO Last In First Out principle.' })
      });
      await fetch(`${BASE_URL}/attempts/${attempt1Id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ questionId: q2Id, studentAnswer: 'Push operation adds element to top of stack, pop removes element from top.' })
      });

      console.log('Submitting Attempt 1 (All Correct Answers)...');
      await fetch(`${BASE_URL}/attempts/${attempt1Id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });

      // Run synchronous diagnostic generation for test inspection
      const diagResultA = await diagnosticService.generateDiagnosticReport({
        attemptId: attempt1Id,
        userId: studentId,
        userRole: 'student'
      });

      const reportA = diagResultA.report;
      const pathA = diagResultA.learningPath;

      console.log(`✓ Attempt 1 evaluated DB status: ${reportA ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✓ Report A score: ${reportA.overallMasteryScore}, level: ${reportA.masteryLevel}`);
      console.log(`✓ Report A weak concepts count: ${reportA.weakConcepts?.length || 0}`);
      console.log(`✓ Learning Path A status: ${pathA?.status}, nodes count: ${pathA?.nodes?.length || 0}`);

      if (reportA.overallMasteryScore < 75 && reportA.masteryLevel !== 'mastered') {
        throw new Error('Scenario A failed: 100% correct answers did not achieve topic mastery!');
      }
      if (pathA && pathA.nodes.length !== 0) {
        throw new Error(`Scenario A failed: Mastered topic generated ${pathA.nodes.length} unnecessary remediation tasks! (Expected 0)`);
      }

      // Fetch student result via API endpoints
      const reportApiResA = await fetch(`${BASE_URL}/attempts/${attempt1Id}/diagnostic-report`, {
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });
      const reportApiDataA = await reportApiResA.json();
      const studentResultAvailableA = reportApiResA.ok && !!reportApiDataA.data;

      // Fresh duplicate request check (idempotency & persistent report check)
      const reportApiResA2 = await fetch(`${BASE_URL}/attempts/${attempt1Id}/diagnostic-report`, {
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });
      const reportCountA = await DiagnosticReport.countDocuments({ attemptId: attempt1Id });

      console.log(`✓ Student API Diagnostic Result Available: ${studentResultAvailableA}`);
      console.log(`✓ Idempotency Check (Reports in MongoDB Atlas): ${reportCountA} (Expected: 1)`);

      if (reportCountA !== 1) {
        throw new Error(`Scenario A failed: Duplicate DiagnosticReports created! Count: ${reportCountA}`);
      }

      logAssessmentResultFlow('SCENARIO A — MASTERED', {
        assessmentId: assessment1Id,
        attemptId: attempt1Id,
        studentId,
        score: reportA.overallMasteryScore,
        mastered: true,
        diagnosticReportId: reportA._id,
        learningPathId: pathA?._id || 'N/A',
        remediationTaskCount: pathA?.nodes?.length || 0,
        studentResultAvailable: studentResultAvailableA
      });

      // =============================================================
      // SCENARIO B — INCORRECT/MIXED ANSWERS (NOT MASTERED)
      // =============================================================
      console.log('\n==================================================');
      console.log(' SCENARIO B — INCORRECT ANSWERS (NOT MASTERED)');
      console.log('==================================================');

      // Generate Assessment 2 for Scenario B
      const genRes2 = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
        body: JSON.stringify({ title: 'Stacks Remediation Quiz', totalQuestions: 2, difficulty: 'medium' })
      });
      const genData2 = await genRes2.json();
      const assessment2 = genData2.data.assessment;
      const assessment2Id = assessment2._id;

      await fetch(`${BASE_URL}/assessments/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ accessCode: assessment2.accessCode })
      });

      const startRes2 = await fetch(`${BASE_URL}/assessments/${assessment2Id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
      });
      const startData2 = await startRes2.json();
      const attempt2Id = (startData2.data?.attempt || startData2.attempt)._id;

      const q1BId = assessment2.questions[0]._id;
      const q2BId = assessment2.questions[1]._id;

      // Submit WRONG answers
      await fetch(`${BASE_URL}/attempts/${attempt2Id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ questionId: q1BId, studentAnswer: 'Stack uses FIFO order like a queue.' })
      });
      await fetch(`${BASE_URL}/attempts/${attempt2Id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
        body: JSON.stringify({ questionId: q2BId, studentAnswer: 'Push inserts at index 0 and pop removes from end.' })
      });

      console.log('Submitting Attempt 2 (Incorrect Answers)...');
      await fetch(`${BASE_URL}/attempts/${attempt2Id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });

      const diagResultB = await diagnosticService.generateDiagnosticReport({
        attemptId: attempt2Id,
        userId: studentId,
        userRole: 'student'
      });

      const reportB = diagResultB.report;
      const pathB = diagResultB.learningPath;

      console.log(`✓ Attempt 2 evaluated DB status: ${reportB ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✓ Report B score: ${reportB.overallMasteryScore}, level: ${reportB.masteryLevel}`);
      console.log(`✓ Report B weak concepts count: ${reportB.weakConcepts?.length || 0}`);
      console.log(`✓ Learning Path B status: ${pathB?.status}, nodes count: ${pathB?.nodes?.length || 0}`);

      if (reportB.masteryLevel === 'mastered') {
        throw new Error('Scenario B failed: Incorrect answers incorrectly triggered topic mastery!');
      }
      if (!pathB || pathB.nodes.length === 0) {
        throw new Error('Scenario B failed: Weak concepts did not generate remedial learning path nodes!');
      }

      const reportApiResB = await fetch(`${BASE_URL}/attempts/${attempt2Id}/diagnostic-report`, {
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });
      const reportApiDataB = await reportApiResB.json();
      const studentResultAvailableB = reportApiResB.ok && !!reportApiDataB.data;

      logAssessmentResultFlow('SCENARIO B — NOT MASTERED', {
        assessmentId: assessment2Id,
        attemptId: attempt2Id,
        studentId,
        score: reportB.overallMasteryScore,
        mastered: false,
        diagnosticReportId: reportB._id,
        learningPathId: pathB?._id || 'N/A',
        remediationTaskCount: pathB?.nodes?.length || 0,
        studentResultAvailable: studentResultAvailableB
      });

      console.log('\n=== ALL POST-ASSESSMENT SUBMISSION MASTERY RESULT FLOW TESTS PASSED 100%! ===');

    } catch (err) {
      console.error('Mastery Result Flow Test FAILED:', err);
      process.exit(1);
    } finally {
      await User.deleteMany({ email: { $in: [teacherEmail, studentEmail] } });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Stacks Data Structure Mastery' });
      await Material.deleteMany({ title: 'Stacks Mastery Material' });
      await Assessment.deleteMany({});
      await AssessmentAssignment.deleteMany({});
      await Attempt.deleteMany({});
      await AttemptResponse.deleteMany({});
      await DiagnosticReport.deleteMany({});
      await LearningPath.deleteMany({});

      const testUploadsDir = path.join(__dirname, 'uploads');
      if (fs.existsSync(testUploadsDir)) {
        fs.rmSync(testUploadsDir, { recursive: true, force: true });
      }

      console.log('Cleanup completed successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runMasteryResultFlowTest();
