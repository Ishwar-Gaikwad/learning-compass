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
import { DocumentChunk } from './src/models/DocumentChunk.js';
import { Assessment } from './src/models/Assessment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5110;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runRAGTopicIsolationTest = async () => {
  console.log('=== Starting RAG Topic Scoping & Isolation Regression Test ===');

  await connectDB();

  const teacherEmail = `rag_isolation_teacher_${Date.now()}@test.com`;
  const courseACode = `MATH-ISO-${Date.now()}`;
  const courseBCode = `DSA-ISO-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // 1. Register Teacher
      console.log('\n--- Setup 1: Register Teacher ---');
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Isolation Test', email: teacherEmail, password: 'password123', role: 'teacher' })
      });
      const regData = await regRes.json();
      const token = regData.data?.token || regData.token;
      const teacherId = regData.data?.user?._id || regData.user?._id;

      // 2. Create Course A (Class 10 Mathematics) & Topic A (Quadratic Equations)
      console.log('\n--- Setup 2: Create Course A & Topic A (Quadratic Equations) ---');
      const courseARes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Class 10 Mathematics', description: 'Algebra and quadratic equations', code: courseACode, subject: 'Math', gradeLevel: '10th' })
      });
      const courseAData = await courseARes.json();
      const courseAId = courseAData.data.course._id;

      const topicARes = await fetch(`${BASE_URL}/courses/${courseAId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Quadratic Equations', order: 1 })
      });
      const topicAData = await topicARes.json();
      const topicAId = topicAData.data.topic._id;

      // Upload quadratic.pdf
      const pdfAText = 
        '1 0 obj << /Length 400 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Quadratic equation ax^2 + bx + c = 0 has solutions given by the quadratic formula x = (-b +- sqrt(b^2 - 4ac)) / (2a). The discriminant b^2 - 4ac determines the nature of roots: positive for real distinct roots, zero for equal real roots, negative for complex roots.) Tj ET\n' +
        'endstream endobj';
      const pdfABuffer = Buffer.from(pdfAText);
      const formA = new FormData();
      formA.append('file', new Blob([pdfABuffer], { type: 'application/pdf' }), 'quadratic.pdf');
      formA.append('title', 'Quadratic Equations Guide');

      const uploadARes = await fetch(`${BASE_URL}/courses/${courseAId}/topics/${topicAId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formA
      });
      const uploadAData = await uploadARes.json();
      const materialAId = uploadAData.data.material._id;

      const processARes = await fetch(`${BASE_URL}/materials/${materialAId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processAData = await processARes.json();
      console.log('Material A (quadratic.pdf) status:', processAData.data.material.status);

      // 3. Create Course B (DSA) & Topic B (Stacks)
      console.log('\n--- Setup 3: Create Course B & Topic B (Stacks) ---');
      const courseBRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'DSA', description: 'Data Structures and Algorithms', code: courseBCode, subject: 'Computer Science', gradeLevel: 'Undergraduate' })
      });
      const courseBData = await courseBRes.json();
      const courseBId = courseBData.data.course._id;

      const topicBRes = await fetch(`${BASE_URL}/courses/${courseBId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Stacks', order: 1 })
      });
      const topicBData = await topicBRes.json();
      const topicBId = topicBData.data.topic._id;

      // Upload stacks.pdf
      const pdfBText = 
        '1 0 obj << /Length 400 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (A stack is a Last-In First-Out LIFO linear data structure supporting push and pop operations. Primary operations include push to insert element, pop to remove top element, and peek to view the top element. Stacks are commonly used in function call stack management and expression evaluation.) Tj ET\n' +
        'endstream endobj';
      const pdfBBuffer = Buffer.from(pdfBText);
      const formB = new FormData();
      formB.append('file', new Blob([pdfBBuffer], { type: 'application/pdf' }), 'stacks.pdf');
      formB.append('title', 'Stacks Data Structure Guide');

      const uploadBRes = await fetch(`${BASE_URL}/courses/${courseBId}/topics/${topicBId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formB
      });
      const uploadBData = await uploadBRes.json();
      const materialBId = uploadBData.data.material._id;

      const processBRes = await fetch(`${BASE_URL}/materials/${materialBId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processBData = await processBRes.json();
      console.log('Material B (stacks.pdf) status:', processBData.data.material.status);

      // Verify DocumentChunks count for both
      const chunksA = await DocumentChunk.find({ materialId: materialAId });
      const chunksB = await DocumentChunk.find({ materialId: materialBId });
      console.log(`DocumentChunks stored - Quadratic: ${chunksA.length}, Stacks: ${chunksB.length}`);

      // 4. TEST CASE 1: Generate Assessment for DSA -> Stacks
      console.log('\n=============================================================');
      console.log('--- TEST CASE 1: Generate Assessment for DSA -> Stacks ---');
      console.log('=============================================================');

      const genBRes = await fetch(`${BASE_URL}/courses/${courseBId}/topics/${topicBId}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          totalQuestions: 3,
          difficulty: 'medium',
          questionTypes: ['mcq', 'short_answer']
        })
      });

      const genBData = await genBRes.json();
      console.log('Generate Stacks Assessment Response Status:', genBRes.status);
      if (!genBRes.ok) {
        console.error('Error generating Stacks assessment:', genBData);
        throw new Error(`Stacks assessment generation failed: ${genBData.message}`);
      }

      const assessmentB = genBData.data.assessment;
      console.log(`Retrieved chunks count reported: ${genBData.data.retrievedChunksCount}`);
      console.log(`Source materials count reported: ${genBData.data.sourceMaterialsCount}`);
      console.log(`Generated Title: "${assessmentB.title}"`);
      console.log(`Questions generated count: ${assessmentB.questions.length}`);

      // Verification Step 1 & 2 & 3: RAG Scoping Check
      console.log('\n--- Verifying RAG Scoping for DSA -> Stacks ---');
      const retrievedSourceMatIdsB = assessmentB.sourceMaterialsUsed || [];
      console.log('Assessment B sourceMaterialsUsed:', retrievedSourceMatIdsB);

      const containsOnlyStacksMaterials = retrievedSourceMatIdsB.every((id) => id.toString() === materialBId.toString());
      const containsZeroQuadraticMaterials = !retrievedSourceMatIdsB.includes(materialAId.toString());

      console.log(`[VERIFY 1] retrievedChunksCount > 0: ${genBData.data.retrievedChunksCount > 0}`);
      console.log(`[VERIFY 2] Every source material is stacks.pdf (materialBId): ${containsOnlyStacksMaterials}`);
      console.log(`[VERIFY 3] Zero quadratic.pdf chunks retrieved: ${containsZeroQuadraticMaterials}`);

      if (!containsOnlyStacksMaterials || !containsZeroQuadraticMaterials) {
        throw new Error('TEST FAILED: Stacks assessment retrieved chunks from Quadratic Equations material!');
      }

      // Verification Step 4, 5, 6: Question Content Check
      console.log('\n--- Verifying Question Subject Matter ---');
      const questionsBText = JSON.stringify(assessmentB.questions).toLowerCase();
      const mentionsStacks = questionsBText.includes('stack') || questionsBText.includes('lifo') || questionsBText.includes('push') || questionsBText.includes('pop');
      const mentionsQuadratic = questionsBText.includes('quadratic') || questionsBText.includes('discriminant') || questionsBText.includes('formula') || questionsBText.includes('degree');

      console.log(`[VERIFY 4 & 5] Questions mention Stacks/LIFO/Push/Pop: ${mentionsStacks}`);
      console.log(`[VERIFY 6] Questions mention zero Quadratic/Discriminant terms: ${!mentionsQuadratic}`);

      if (!mentionsStacks || mentionsQuadratic) {
        throw new Error(`TEST FAILED: Questions contained off-topic content. Mentions Stacks: ${mentionsStacks}, Mentions Quadratic: ${mentionsQuadratic}`);
      }

      // 5. TEST CASE 2: Reverse Test — Generate Assessment for Math -> Quadratic Equations
      console.log('\n=============================================================');
      console.log('--- TEST CASE 2: Generate Assessment for Math -> Quadratic Equations ---');
      console.log('=============================================================');

      const genARes = await fetch(`${BASE_URL}/courses/${courseAId}/topics/${topicAId}/assessments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          totalQuestions: 3,
          difficulty: 'medium',
          questionTypes: ['mcq', 'short_answer']
        })
      });

      const genAData = await genARes.json();
      console.log('Generate Quadratic Assessment Response Status:', genARes.status);
      if (!genARes.ok) {
        console.error('Error generating Quadratic assessment:', genAData);
        throw new Error(`Quadratic assessment generation failed: ${genAData.message}`);
      }

      const assessmentA = genAData.data.assessment;
      const retrievedSourceMatIdsA = assessmentA.sourceMaterialsUsed || [];
      console.log('Assessment A sourceMaterialsUsed:', retrievedSourceMatIdsA);

      const containsOnlyQuadraticMaterials = retrievedSourceMatIdsA.every((id) => id.toString() === materialAId.toString());
      const containsZeroStacksMaterials = !retrievedSourceMatIdsA.includes(materialBId.toString());

      console.log(`[VERIFY REVERSE 1] Every source material is quadratic.pdf (materialAId): ${containsOnlyQuadraticMaterials}`);
      console.log(`[VERIFY REVERSE 2] Zero stacks.pdf chunks retrieved: ${containsZeroStacksMaterials}`);

      if (!containsOnlyQuadraticMaterials || !containsZeroStacksMaterials) {
        throw new Error('TEST FAILED: Quadratic assessment retrieved chunks from Stacks material!');
      }

      console.log('\n=== ALL RAG TOPIC ISOLATION REGRESSION TESTS PASSED 100%! ===');

    } catch (err) {
      console.error('RAG Topic Isolation Test FAILED:', err);
      process.exit(1);
    } finally {
      await User.deleteMany({ email: teacherEmail });
      await Course.deleteMany({ code: { $in: [courseACode, courseBCode] } });
      await Topic.deleteMany({ title: { $in: ['Quadratic Equations', 'Stacks'] } });
      await Material.deleteMany({ title: { $in: ['Quadratic Equations Guide', 'Stacks Data Structure Guide'] } });
      await DocumentChunk.deleteMany({});
      await Assessment.deleteMany({});

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

runRAGTopicIsolationTest();
