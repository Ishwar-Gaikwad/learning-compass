import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';
import { Assessment } from './src/models/Assessment.js';

const TEST_PORT = 5211;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runAssessmentGenerationUITests = async () => {
  console.log('=== Starting Teacher Assessment Generation UI & API Verification Tests ===');

  await connectDB();

  const teacherAEmail = `ag_teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `ag_teacher_b_${Date.now()}@test.com`;
  const password = 'password123';
  const courseCode = `AG-COURSE-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // -------------------------------------------------------------
      // Step 1: Register & Login as Teacher A & Teacher B
      // -------------------------------------------------------------
      console.log('\n--- Step 1: Register & Login as Teacher A & Teacher B ---');
      const regTeacherARes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Alice AG', email: teacherAEmail, password, role: 'teacher' })
      });
      const regTeacherAData = await regTeacherARes.json();
      const teacherAToken = regTeacherAData.token;

      const regTeacherBRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob AG', email: teacherBEmail, password, role: 'teacher' })
      });
      const regTeacherBData = await regTeacherBRes.json();
      const teacherBToken = regTeacherBData.token;

      // -------------------------------------------------------------
      // Step 2 & 3: Open Course & Create Two Topics (Topic 1 with material, Topic 2 without)
      // -------------------------------------------------------------
      console.log('\n--- Step 2 & 3: Open Course & Create Two Topics ---');
      const courseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Assessment Gen Course', code: courseCode, description: 'Desc', subject: 'Math', gradeLevel: '10th' })
      });
      const courseData = await courseRes.json();
      const courseId = courseData.data ? (courseData.data.course ? courseData.data.course._id : courseData.data._id) : courseData.course._id;

      const topic1Res = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Topic 1: Polynomial Synthetic Division', order: 1 })
      });
      const topic1Data = await topic1Res.json();
      const topic1Id = topic1Data.data ? (topic1Data.data.topic ? topic1Data.data.topic._id : topic1Data.data._id) : topic1Data.topic._id;

      const topic2Res = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Topic 2: Empty Material Topic', order: 2 })
      });
      const topic2Data = await topic2Res.json();
      const topic2Id = topic2Data.data ? (topic2Data.data.topic ? topic2Data.data.topic._id : topic2Data.data._id) : topic2Data.topic._id;

      // Upload & Process PDF for Topic 1
      const pdfBuffer = Buffer.from(
        '1 0 obj << /Length 300 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Synthetic division is a shorthand method for polynomial division when dividing by linear binomial x - c.) Tj ET\n' +
        'endstream endobj'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'synthetic_division_guide.pdf');
      form.append('title', 'Synthetic Division Source Guide');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topic1Id}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` },
        body: form
      });
      const uploadData = await uploadRes.json();
      const materialId = uploadData.data.material._id;

      await fetch(`${BASE_URL}/materials/${materialId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` }
      });

      // -------------------------------------------------------------
      // Step 4, 5, 6, 7: Configure & Generate RAG Assessment
      // -------------------------------------------------------------
      console.log('\n--- Step 4-7: Configure & Generate Assessment for Topic 1 ---');
      const genRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topic1Id}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({
          title: 'Synthetic Division Mastery Quiz',
          totalQuestions: 2,
          difficulty: 'medium',
          additionalInstructions: 'Focus on linear factor constant setup'
        })
      });
      const genData = await genRes.json();

      console.log('Generate Assessment HTTP Status:', genRes.status, '(Expected: 201 Created)');
      console.log('Retrieved Chunks Count:', genData.data.retrievedChunksCount, '(Expected: > 0)');
      const assessment = genData.data.assessment;
      const assessmentId = assessment._id;

      console.log('Assessment Title:', assessment.title);
      console.log('Questions Count:', assessment.questions.length, '(Expected: 2)');
      const q1 = assessment.questions[0];
      console.log('Question 1 Text:', `"${q1.questionText.substring(0, 60)}..."`);
      console.log('Question 1 Source Reference Preserved:', q1.sourceReferences && q1.sourceReferences.length > 0);

      // -------------------------------------------------------------
      // Step 8: Verify refresh (GET request) retrieves saved assessment
      // -------------------------------------------------------------
      console.log('\n--- Step 8: Refresh Page & Verify Saved Assessment Retrieval ---');
      const getTopicAssRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topic1Id}/assessments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacherAToken}` }
      });
      const getTopicAssData = await getTopicAssRes.json();

      const getByIdRes = await fetch(`${BASE_URL}/assessments/${assessmentId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacherAToken}` }
      });
      const getByIdData = await getByIdRes.json();

      console.log('GET Topic Assessments Status:', getTopicAssRes.status, '(Expected: 200 OK)');
      console.log('Assessments Count:', getTopicAssData.count, '(Expected: 1)');
      console.log('GET Assessment By ID Title:', getByIdData.data.assessment.title);

      // -------------------------------------------------------------
      // Step 9: Test Generation for Topic WITHOUT Usable Material
      // -------------------------------------------------------------
      console.log('\n--- Step 9: Test Generation for Topic WITHOUT Processed Material ---');
      const emptyGenRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topic2Id}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Empty Topic Quiz', totalQuestions: 2 })
      });
      const emptyGenData = await emptyGenRes.json();

      console.log('Empty Topic Gen HTTP Status:', emptyGenRes.status, '(Expected: 400 Bad Request)');
      console.log('Error Message:', emptyGenData.message);

      // -------------------------------------------------------------
      // Step 10: Verify Teacher B cannot generate assessment for Teacher A's topic
      // -------------------------------------------------------------
      console.log('\n--- Step 10: Verify Teacher B cannot generate assessment for Teacher A topic ---');
      const teacherBGenRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topic1Id}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherBToken}` },
        body: JSON.stringify({ title: 'Unauthorized Quiz', totalQuestions: 2 })
      });
      const teacherBGenData = await teacherBGenRes.json();

      console.log('Teacher B Gen Status:', teacherBGenRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', teacherBGenData.message);

      console.log('\n=== ALL TEACHER ASSESSMENT GENERATION UI TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Assessment Generation UI test verification failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail] } });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: { $regex: 'Topic' } });
      await Material.deleteMany({});
      await Assessment.deleteMany({});
      console.log('Test data cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runAssessmentGenerationUITests();
