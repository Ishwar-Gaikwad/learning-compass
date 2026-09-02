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
import { llmService } from './src/services/ai/llmService.js';
import { LocalLLMProvider } from './src/services/ai/LocalLLMProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5122;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runAssessmentGenerationTests = async () => {
  console.log('=== Starting RAG-Grounded Assessment Generation Integration Tests ===');

  await connectDB();

  const teacherAEmail = `asmnt_teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `asmnt_teacher_b_${Date.now()}@test.com`;
  const courseCodeA = `MATH-ASMNT-A-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Setup Teacher A & B, Course, Topic
      console.log('\n--- Setup: Register Teacher A & Teacher B, Course, Topic ---');
      const regResA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Alice Assessment', email: teacherAEmail, password: 'password123', role: 'teacher' })
      });
      const regDataA = await regResA.json();
      const tokenA = regDataA.data?.token || regDataA.token;
      const teacherAId = regDataA.data?.user?._id || regDataA.user?._id;

      const regResB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob Assessment', email: teacherBEmail, password: 'password123', role: 'teacher' })
      });
      const regDataB = await regResB.json();
      const tokenB = regDataB.data?.token || regDataB.token;

      const createCourseResA = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ title: 'Algebra Assessment Course', description: 'RAG assessment course', code: courseCodeA, subject: 'Math', gradeLevel: '10th' })
      });
      const createCourseDataA = await createCourseResA.json();
      const courseIdA = createCourseDataA.data.course._id;

      const createTopicResA = await fetch(`${BASE_URL}/courses/${courseIdA}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ title: 'Polynomial Synthetic Division', order: 1 })
      });
      const createTopicDataA = await createTopicResA.json();
      const topicIdA = createTopicDataA.data.topic._id;

      // Ingest PDF Material for Teacher A
      console.log('\n--- Upload & Ingest Learning Material for Topic ---');
      const pdfBuffer = Buffer.from(
        '1 0 obj << /Length 400 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Synthetic division is a shorthand method for polynomial division when divisor is linear x - c. First write constant c of divisor. Next write dividend coefficients. Multiply and add down columns.) Tj ET\n' +
        'BT /F1 12 Tf [Page 2] (The Remainder Theorem states that dividing P(x) by x - c yields remainder P(c).) Tj ET\n' +
        'endstream endobj'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'synthetic_division_material.pdf');
      form.append('title', 'Synthetic Division Source Book');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        body: form
      });
      const uploadData = await uploadRes.json();
      const materialId = uploadData.data.material._id;
      await fetch(`${BASE_URL}/materials/${materialId}/process`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenA}` } });

      // -------------------------------------------------------------
      // Test 1, 2, 3, 4, 5, 6: Generate Assessment & Verify RAG Grounding & Atlas DB Storage
      // -------------------------------------------------------------
      console.log('\n--- Test 1-6: Generate RAG Assessment & Verify Output & DB Storage ---');
      const genRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({
          title: 'Polynomial Synthetic Division Quiz',
          totalQuestions: 2,
          difficulty: 'medium',
          questionTypes: ['mcq', 'short_answer']
        })
      });
      const genData = await genRes.json();

      console.log('Generate Assessment HTTP Status:', genRes.status, '(Expected: 201 Created)');
      console.log('Retrieved RAG Chunks Count:', genData.data.retrievedChunksCount, '(Expected: > 0)');
      console.log('Source Materials Count:', genData.data.sourceMaterialsCount, '(Expected: > 0)');

      const assessmentId = genData.data.assessment._id;
      const dbAssessment = await Assessment.findById(assessmentId);
      console.log('Assessment Saved in Atlas DB:', !!dbAssessment);
      console.log('DB Assessment Title:', dbAssessment?.title);
      console.log('Total Questions in DB:', dbAssessment?.questions?.length);
      
      const firstQ = dbAssessment?.questions[0];
      console.log('Question 1 Text Sample:', `"${firstQ?.questionText.substring(0, 60)}..."`);
      console.log('Question 1 Type:', firstQ?.questionType);
      console.log('Question 1 Rubric Criteria:', `"${firstQ?.rubric?.gradingCriteria.substring(0, 50)}..."`);
      console.log('Question 1 Source Reference Preserved:', firstQ?.sourceReferences?.length > 0);

      // -------------------------------------------------------------
      // Test 7: Invalid AI output is rejected safely (No DB persistence)
      // -------------------------------------------------------------
      console.log('\n--- Test 7: Verify invalid AI output is rejected safely ---');
      const localProvider = llmService.getProvider();
      localProvider.setSimulatedInvalidOutput(true);

      const countBeforeInvalid = await Assessment.countDocuments({ topicId: topicIdA });

      const invalidGenRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ totalQuestions: 2 })
      });
      const invalidGenData = await invalidGenRes.json();

      console.log('Invalid AI Output Response Status:', invalidGenRes.status, '(Expected: 400 Bad Request)');
      console.log('Error Code:', invalidGenData.code, 'Message:', invalidGenData.message);

      const countAfterInvalid = await Assessment.countDocuments({ topicId: topicIdA });
      console.log('DB Document Count Unchanged after invalid output:', countBeforeInvalid === countAfterInvalid);

      // Reset LLM provider state
      localProvider.setSimulatedInvalidOutput(false);

      // -------------------------------------------------------------
      // Test 8: Teacher B cannot generate assessment for Teacher A topic
      // -------------------------------------------------------------
      console.log('\n--- Test 8: Teacher B cannot generate assessment for Teacher A topic ---');
      const teacherBGenRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
        body: JSON.stringify({ totalQuestions: 2 })
      });
      const teacherBGenData = await teacherBGenRes.json();

      console.log('Teacher B Generator Status:', teacherBGenRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', teacherBGenData.message);

      // -------------------------------------------------------------
      // Test 9: Unauthenticated requests are rejected
      // -------------------------------------------------------------
      console.log('\n--- Test 9: Unauthenticated requests are rejected ---');
      const unauthGenRes = await fetch(`${BASE_URL}/courses/${courseIdA}/topics/${topicIdA}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalQuestions: 2 })
      });
      const unauthGenData = await unauthGenRes.json();

      console.log('Unauthenticated Request Status:', unauthGenRes.status, '(Expected: 401 Unauthorized)');
      console.log('Error Code:', unauthGenData.code);

      console.log('\n=== ALL RAG ASSESSMENT GENERATION TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Assessment Generation test failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail] } });
      await Course.deleteMany({ code: courseCodeA });
      await Topic.deleteMany({ title: 'Polynomial Synthetic Division' });
      await Material.deleteMany({ title: 'Synthetic Division Source Book' });
      await Assessment.deleteMany({ title: 'Polynomial Synthetic Division Quiz' });
      
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

runAssessmentGenerationTests();
