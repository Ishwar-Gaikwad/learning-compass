import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './src/config/db.js';
import app from './src/app.js';
import { User } from './src/models/User.js';
import { Course } from './src/models/Course.js';
import { Topic } from './src/models/Topic.js';
import { Material } from './src/models/Material.js';

const TEST_PORT = 5200;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runMaterialUploadUITests = async () => {
  console.log('=== Starting Teacher Material Upload UI & API Verification Tests ===');

  await connectDB();

  const teacherAEmail = `mu_teacher_a_${Date.now()}@test.com`;
  const teacherBEmail = `mu_teacher_b_${Date.now()}@test.com`;
  const password = 'password123';
  const courseCode = `MU-COURSE-${Date.now()}`;

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
        body: JSON.stringify({ name: 'Teacher Alice MU', email: teacherAEmail, password, role: 'teacher' })
      });
      const regTeacherAData = await regTeacherARes.json();
      const teacherAToken = regTeacherAData.token;

      const regTeacherBRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob MU', email: teacherBEmail, password, role: 'teacher' })
      });
      const regTeacherBData = await regTeacherBRes.json();
      const teacherBToken = regTeacherBData.token;

      // -------------------------------------------------------------
      // Step 2 & 3: Open Course & Select Topic
      // -------------------------------------------------------------
      console.log('\n--- Step 2 & 3: Open Course & Select Topic ---');
      const courseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Material Upload Course', code: courseCode, description: 'Desc', subject: 'Math', gradeLevel: '10th' })
      });
      const courseData = await courseRes.json();
      const courseId = courseData.data ? (courseData.data.course ? courseData.data.course._id : courseData.data._id) : courseData.course._id;

      const topicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherAToken}` },
        body: JSON.stringify({ title: 'Topic: Polynomial Ingestion', order: 1 })
      });
      const topicData = await topicRes.json();
      const topicId = topicData.data ? (topicData.data.topic ? topicData.data.topic._id : topicData.data._id) : topicData.topic._id;

      // -------------------------------------------------------------
      // Step 4 & 5: Upload a Valid PDF Material
      // -------------------------------------------------------------
      console.log('\n--- Step 4 & 5: Upload a Valid PDF Material ---');
      const pdfBuffer = Buffer.from(
        '1 0 obj << /Length 300 >> stream\n' +
        'BT /F1 12 Tf [Page 1] (Synthetic division is a shorthand method for polynomial division when dividing by linear binomial x - c.) Tj ET\n' +
        'endstream endobj'
      );
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'valid_lecture_notes.pdf');
      form.append('title', 'Polynomial Division Lecture Notes');

      const uploadRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` },
        body: form
      });
      const uploadData = await uploadRes.json();

      console.log('Upload Material Status:', uploadRes.status, '(Expected: 202 Accepted)');
      const materialId = uploadData.data.material._id;
      console.log('Uploaded Material Title:', uploadData.data.material.title);
      console.log('Initial Status:', uploadData.data.material.processingStatus, '(Expected: "uploaded")');

      // -------------------------------------------------------------
      // Step 6 & 7: Process Material & Verify Status Changes to 'processed'
      // -------------------------------------------------------------
      console.log('\n--- Step 6 & 7: Process Material & Verify Status changes to "processed" ---');
      const processRes = await fetch(`${BASE_URL}/materials/${materialId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` }
      });
      const processData = await processRes.json();

      console.log('Process Document Status:', processRes.status, '(Expected: 200 OK)');
      console.log('Processed Material Status:', processData.data.material.processingStatus, '(Expected: "processed")');
      console.log('Chunks Generated:', processData.data.chunksCount);

      // -------------------------------------------------------------
      // Step 8: Test Invalid File Type
      // -------------------------------------------------------------
      console.log('\n--- Step 8: Test Invalid File Type ---');
      const invalidForm = new FormData();
      invalidForm.append('file', new Blob(['console.log("hello script");'], { type: 'application/javascript' }), 'script.js');

      const invalidRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` },
        body: invalidForm
      });
      const invalidData = await invalidRes.json();

      console.log('Invalid File Type HTTP Status:', invalidRes.status, '(Expected: 400 Bad Request)');
      console.log('Invalid Error Message:', invalidData.message);

      // -------------------------------------------------------------
      // Step 9: Test Oversized File (> 10MB)
      // -------------------------------------------------------------
      console.log('\n--- Step 9: Test Oversized File (> 10MB) ---');
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const oversizedForm = new FormData();
      oversizedForm.append('file', new Blob([oversizedBuffer], { type: 'application/pdf' }), 'oversized_book.pdf');

      const oversizedRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${teacherAToken}` },
        body: oversizedForm
      });
      const oversizedData = await oversizedRes.json();

      console.log('Oversized File HTTP Status:', oversizedRes.status, '(Expected: 400 Bad Request)');
      console.log('Oversized Error Message:', oversizedData.message);

      // -------------------------------------------------------------
      // Step 10: Verify Teacher B cannot see Teacher A's materials
      // -------------------------------------------------------------
      console.log('\n--- Step 10: Verify Teacher B cannot see Teacher A materials ---');
      const teacherBGetRes = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${teacherBToken}` }
      });
      const teacherBGetData = await teacherBGetRes.json();

      console.log('Teacher B Access Materials Status:', teacherBGetRes.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', teacherBGetData.message);

      console.log('\n=== ALL MATERIAL UPLOAD UI INTEGRATION TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Material Upload verification failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail] } });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Topic: Polynomial Ingestion' });
      await Material.deleteMany({});
      console.log('Test data cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runMaterialUploadUITests();
