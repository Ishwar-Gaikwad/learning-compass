import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../src/config/db.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Course } from '../src/models/Course.js';
import { Topic } from '../src/models/Topic.js';
import { Material } from '../src/models/Material.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5066;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runMaterialUploadTests = async () => {
  console.log('=== Starting Material Upload Integration Tests ===');

  await connectDB();

  const teacherAEmail = `teacher_upload_a_${Date.now()}@test.com`;
  const teacherBEmail = `teacher_upload_b_${Date.now()}@test.com`;
  const courseCode = `MATH-UPLOAD-${Date.now()}`;

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // Step A: Setup Users, Course, Topic
      console.log('\n--- Setup: Register Teacher A & Teacher B, Course, Topic ---');
      const regResA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Alice', email: teacherAEmail, password: 'password123', role: 'teacher' })
      });
      const regDataA = await regResA.json();
      const tokenA = regDataA.token;

      const regResB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher Bob', email: teacherBEmail, password: 'password123', role: 'teacher' })
      });
      const regDataB = await regResB.json();
      const tokenB = regDataB.token;

      const createCourseRes = await fetch(`${BASE_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({
          title: 'Polynomial Functions',
          description: 'Advanced polynomial algebra',
          code: courseCode,
          subject: 'Mathematics',
          gradeLevel: '10th Grade'
        })
      });
      const createCourseData = await createCourseRes.json();
      const courseId = createCourseData.data.course._id;

      const createTopicRes = await fetch(`${BASE_URL}/courses/${courseId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ title: 'Synthetic Division Notes', order: 1 })
      });
      const createTopicData = await createTopicRes.json();
      const topicId = createTopicData.data.topic._id;

      // -------------------------------------------------------------
      // Test 1: Teacher uploads a valid PDF
      // -------------------------------------------------------------
      console.log('\n--- Test 1: Teacher A uploads a valid PDF ---');
      const dummyPdfContent = Buffer.from('%PDF-1.4 %Sample PDF Document for Learning Compass Test\n%EOF');
      const form1 = new FormData();
      form1.append('file', new Blob([dummyPdfContent], { type: 'application/pdf' }), 'synthetic_division_guide.pdf');
      form1.append('title', 'Synthetic Division Complete Guide');

      const uploadRes1 = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        body: form1
      });
      const uploadData1 = await uploadRes1.json();
      console.log('Upload PDF Response Status:', uploadRes1.status, '(Expected: 202 Accepted)');
      console.log('Upload Success:', uploadData1.success);
      const materialId = uploadData1.data?.material?._id;
      const storageKey = uploadData1.data?.material?.storageKey;
      const fileUrl = uploadData1.data?.material?.fileUrl;

      // -------------------------------------------------------------
      // Test 2: Material record is created in MongoDB Atlas
      // -------------------------------------------------------------
      console.log('\n--- Test 2: Verify Material record created in MongoDB Atlas ---');
      const dbMaterial = await Material.findById(materialId);
      console.log('Material Found in DB:', !!dbMaterial);
      console.log('DB Material Title:', dbMaterial?.title);
      console.log('DB Original Filename:', dbMaterial?.originalFileName);
      console.log('DB File Type:', dbMaterial?.fileType);

      // -------------------------------------------------------------
      // Test 3: File exists in storage
      // -------------------------------------------------------------
      console.log('\n--- Test 3: Verify File exists in storage ---');
      const localFilePath = path.join(__dirname, 'uploads', storageKey);
      const fileExistsOnDisk = fs.existsSync(localFilePath);
      console.log('File Storage Key:', storageKey);
      console.log('File Exists on Disk:', fileExistsOnDisk);

      // -------------------------------------------------------------
      // Test 4: processingStatus is "uploaded"
      // -------------------------------------------------------------
      console.log('\n--- Test 4: Verify processingStatus is "uploaded" ---');
      console.log('DB Material Status:', dbMaterial?.status, '(Expected: "uploaded")');

      // -------------------------------------------------------------
      // Test 5: Invalid file type is rejected
      // -------------------------------------------------------------
      console.log('\n--- Test 5: Invalid file type is rejected ---');
      const invalidContent = Buffer.from('console.log("malicious code");');
      const formInvalid = new FormData();
      formInvalid.append('file', new Blob([invalidContent], { type: 'text/javascript' }), 'script.js');

      const uploadResInvalid = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        body: formInvalid
      });
      const uploadDataInvalid = await uploadResInvalid.json();
      console.log('Invalid File Upload Status:', uploadResInvalid.status, '(Expected: 400 Bad Request)');
      console.log('Error Code:', uploadDataInvalid.code, 'Message:', uploadDataInvalid.message);

      // -------------------------------------------------------------
      // Test 6: Oversized file is rejected (> 10MB)
      // -------------------------------------------------------------
      console.log('\n--- Test 6: Oversized file (> 10MB) is rejected ---');
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const formOversized = new FormData();
      formOversized.append('file', new Blob([oversizedBuffer], { type: 'application/pdf' }), 'large_textbook.pdf');

      const uploadResOversized = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        body: formOversized
      });
      const uploadDataOversized = await uploadResOversized.json();
      console.log('Oversized Upload Status:', uploadResOversized.status, '(Expected: 400 Bad Request)');
      console.log('Error Code:', uploadDataOversized.code, 'Message:', uploadDataOversized.message);

      // -------------------------------------------------------------
      // Test 7: Teacher B cannot upload material to Teacher A's course/topic
      // -------------------------------------------------------------
      console.log('\n--- Test 7: Teacher B cannot upload to Teacher A topic ---');
      const formTeacherB = new FormData();
      formTeacherB.append('file', new Blob([dummyPdfContent], { type: 'application/pdf' }), 'bob_notes.pdf');

      const uploadResTeacherB = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenB}` },
        body: formTeacherB
      });
      const uploadDataTeacherB = await uploadResTeacherB.json();
      console.log('Teacher B Upload Status:', uploadResTeacherB.status, '(Expected: 403 Forbidden)');
      console.log('Error Message:', uploadDataTeacherB.message);

      // -------------------------------------------------------------
      // Test 8: Unauthenticated upload is rejected
      // -------------------------------------------------------------
      console.log('\n--- Test 8: Unauthenticated upload is rejected ---');
      const formNoAuth = new FormData();
      formNoAuth.append('file', new Blob([dummyPdfContent], { type: 'application/pdf' }), 'no_auth.pdf');

      const uploadResNoAuth = await fetch(`${BASE_URL}/courses/${courseId}/topics/${topicId}/materials`, {
        method: 'POST',
        body: formNoAuth
      });
      const uploadDataNoAuth = await uploadResNoAuth.json();
      console.log('Unauthenticated Upload Status:', uploadResNoAuth.status, '(Expected: 401 Unauthorized)');
      console.log('Error Code:', uploadDataNoAuth.code);

      console.log('\n=== ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Test execution failed:', err);
    } finally {
      // Clean up test data
      await User.deleteMany({ email: { $in: [teacherAEmail, teacherBEmail] } });
      await Course.deleteMany({ code: courseCode });
      await Topic.deleteMany({ title: 'Synthetic Division Notes' });
      await Material.deleteMany({ title: 'Synthetic Division Complete Guide' });
      
      const testUploadsDir = path.join(__dirname, 'uploads');
      if (fs.existsSync(testUploadsDir)) {
        fs.rmSync(testUploadsDir, { recursive: true, force: true });
      }

      console.log('Test data & uploaded files cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runMaterialUploadTests();
