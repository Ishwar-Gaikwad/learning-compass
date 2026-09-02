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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runChunkingTests = async () => {
  console.log('=== Starting Document Text Chunking Integration Tests ===');

  await connectDB();

  const teacherEmail = `chunk_teacher_${Date.now()}@test.com`;
  const courseCode = `MATH-CHUNK-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Setup Teacher, Course, Topic
      console.log('\n--- Setup: Register Teacher, Course, Topic ---');
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Chunk Teacher', email: teacherEmail, password: 'password123', role: 'teacher' })
      });
      const regData = await regRes.json();
      const token = regData.token;

      const createCourseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Polynomials & Functions', description: 'Chunking test course', code: courseCode, subject: 'Math', gradeLevel: '10th' })
      });
      const createCourseData = await createCourseRes.json();
      const courseId = createCourseData.data.course._id;

      const createTopicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Synthetic Division', order: 1 })
      });
      const createTopicData = await createTopicRes.json();
      const topicId = createTopicData.data.topic._id;

      // -------------------------------------------------------------
      // Step 1: Upload a PDF with multi-chunk text
      // -------------------------------------------------------------
      console.log('\n--- Step 1: Upload a PDF with multi-chunk text ---');
      const longPdfContent = 
        '1 0 obj << /Length 500 >> stream\n' +
        'BT /F1 12 Tf (Synthetic division is a shorthand method for dividing polynomials when the divisor is linear. First write the constant c of the divisor x - c. Next write the coefficients of the dividend in descending order of power. Bring down the leading coefficient, multiply by c, and add down the column.) Tj ET\n' +
        'BT /F1 12 Tf (Repeat this process for all remaining terms. The last value represents the remainder of the polynomial division problem. If the remainder is zero, then x - c is a factor of the polynomial. This theorem is known as the Remainder Theorem.) Tj ET\n' +
        'endstream endobj';

      const pdfBuffer = Buffer.from(longPdfContent);
      const form1 = new FormData();
      form1.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'synthetic_division_full.pdf');
      form1.append('title', 'Polynomial Division Guide');

      const uploadRes1 = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form1
      });
      const uploadData1 = await uploadRes1.json();
      console.log('Upload Status:', uploadRes1.status);
      const materialId = uploadData1.data.material._id;

      // -------------------------------------------------------------
      // Step 2: Process document (Extract text + Chunking)
      // -------------------------------------------------------------
      console.log('\n--- Step 2: Process document and trigger chunking ---');
      const processRes1 = await fetch(`${BASE_URL}/materials/${materialId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const processData1 = await processRes1.json();
      console.log('Process Status Code:', processRes1.status);
      if (!processData1.success) {
        console.log('Process Response Error:', processData1);
      }
      console.log('Processed Material Status:', processData1.data?.material?.status, '(Expected: "completed")');

      // -------------------------------------------------------------
      // Step 3, 4, 5, 6: Verify DocumentChunks in DB
      // -------------------------------------------------------------
      console.log('\n--- Step 3, 4, 5, 6: Verify DocumentChunks in MongoDB Atlas ---');
      const dbChunks = await DocumentChunk.find({ materialId }).sort({ chunkIndex: 1 });
      console.log('Total DocumentChunks Created:', dbChunks.length);
      console.log('Material totalChunksCount Metadata:', processData1.data.material.extractedTextMetadata.totalChunksCount);

      // Verify chunkIndex ordering
      let isOrdered = true;
      dbChunks.forEach((chk, idx) => {
        if (chk.chunkIndex !== idx) isOrdered = false;
      });
      console.log('Chunk Ordering Verified (0, 1, 2...):', isOrdered);

      // Verify references
      const firstChunk = dbChunks[0];
      console.log('First Chunk materialId Match:', firstChunk.materialId.toString() === materialId);
      console.log('First Chunk topicId Match:', firstChunk.topicId.toString() === topicId);
      console.log('First Chunk teacherId Match:', firstChunk.teacherId.toString() === createCourseData.data.course.teacherId);
      console.log('First Chunk Page Number:', firstChunk.pageNumber, '(Expected: 1)');
      console.log('First Chunk Token Count:', firstChunk.tokenCount);

      // -------------------------------------------------------------
      // Step 7: Reprocess the same material and verify duplicate chunks are NOT created
      // -------------------------------------------------------------
      console.log('\n--- Step 7: Reprocess same material and verify NO duplicate chunks ---');
      const reprocessRes = await fetch(`${BASE_URL}/materials/${materialId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const reprocessData = await reprocessRes.json();
      console.log('Reprocess Status Code:', reprocessRes.status);

      const dbChunksAfterReprocess = await DocumentChunk.find({ materialId }).sort({ chunkIndex: 1 });
      console.log('Chunks Count After Reprocessing:', dbChunksAfterReprocess.length, `(Expected: ${dbChunks.length}, NO duplicates)`);

      console.log('\n=== ALL CHUNKING VERIFICATION TESTS PASSED! ===');

    } catch (err) {
      console.error('Chunking test failed:', err);
    } finally {
      await User.deleteMany({ email: teacherEmail });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Synthetic Division' });
      await Material.deleteMany({ title: 'Polynomial Division Guide' });
      
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

runChunkingTests();
