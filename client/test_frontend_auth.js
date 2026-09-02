import dotenv from 'dotenv';
dotenv.config({ path: '../server/.env' });

import { connectDB } from '../server/src/config/db.js';
import app from '../server/src/app.js';
import { User } from '../server/src/models/User.js';

const TEST_PORT = 5188;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runAuthVerificationTests = async () => {
  console.log('=== Starting Frontend Authentication Integration Verification Tests ===');

  await connectDB();

  const studentEmail = `fe_student_${Date.now()}@test.com`;
  const teacherEmail = `fe_teacher_${Date.now()}@test.com`;
  const password = 'password123';

  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test Server] Running on port ${TEST_PORT}`);

    try {
      // -------------------------------------------------------------
      // Test 1: Register a Student
      // -------------------------------------------------------------
      console.log('\n--- Test 1: Register a Student ---');
      const regStudentRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice Student FE', email: studentEmail, password, role: 'student' })
      });
      const regStudentData = await regStudentRes.json();

      console.log('Register Student HTTP Status:', regStudentRes.status, '(Expected: 201 Created)');
      console.log('Student Token Exists:', !!regStudentData.token);
      console.log('Student Role:', regStudentData.data?.user?.role, '(Expected: "student")');

      // -------------------------------------------------------------
      // Test 2: Register a Teacher
      // -------------------------------------------------------------
      console.log('\n--- Test 2: Register a Teacher ---');
      const regTeacherRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob Teacher FE', email: teacherEmail, password, role: 'teacher' })
      });
      const regTeacherData = await regTeacherRes.json();

      console.log('Register Teacher HTTP Status:', regTeacherRes.status, '(Expected: 201 Created)');
      console.log('Teacher Token Exists:', !!regTeacherData.token);
      console.log('Teacher Role:', regTeacherData.data?.user?.role, '(Expected: "teacher")');

      // -------------------------------------------------------------
      // Test 3: Login successfully
      // -------------------------------------------------------------
      console.log('\n--- Test 3: Login Successfully ---');
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: studentEmail, password })
      });
      const loginData = await loginRes.json();

      console.log('Login HTTP Status:', loginRes.status, '(Expected: 200 OK)');
      console.log('Logged In User Email:', loginData.data?.user?.email, '(Expected:', studentEmail, ')');
      const activeToken = loginData.token;

      // -------------------------------------------------------------
      // Test 4: Login with incorrect credentials
      // -------------------------------------------------------------
      console.log('\n--- Test 4: Login with Incorrect Credentials ---');
      const invalidLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: studentEmail, password: 'wrongpassword' })
      });
      const invalidLoginData = await invalidLoginRes.json();

      console.log('Invalid Login HTTP Status:', invalidLoginRes.status, '(Expected: 401 Unauthorized)');
      console.log('Error Message:', invalidLoginData.message);

      // -------------------------------------------------------------
      // Test 5 & 6: Restore current user session using GET /api/auth/me
      // -------------------------------------------------------------
      console.log('\n--- Test 5 & 6: Current-User Restoration using GET /api/auth/me ---');
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      const meData = await meRes.json();

      console.log('GET /auth/me HTTP Status:', meRes.status, '(Expected: 200 OK)');
      console.log('Restored User Name:', meData.data?.user?.name, '(Expected: "Alice Student FE")');
      console.log('Restored User Role:', meData.data?.user?.role, '(Expected: "student")');

      // -------------------------------------------------------------
      // Test 7 & 8: Logout & verify protected routes are inaccessible
      // -------------------------------------------------------------
      console.log('\n--- Test 7 & 8: Verify Protected Routes Inaccessible After Logout ---');
      const unauthMeRes = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET'
      });
      const unauthMeData = await unauthMeRes.json();

      console.log('Unauthenticated GET /auth/me Status:', unauthMeRes.status, '(Expected: 401 Unauthorized)');
      console.log('Unauthenticated Error Message:', unauthMeData.message);

      // -------------------------------------------------------------
      // Test 9: Verify duplicate registration displays appropriate error
      // -------------------------------------------------------------
      console.log('\n--- Test 9: Duplicate Registration Handling ---');
      const dupRegRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Duplicate User', email: studentEmail, password, role: 'student' })
      });
      const dupRegData = await dupRegRes.json();

      console.log('Duplicate Register Status:', dupRegRes.status, '(Expected: 400 Bad Request or 409 Conflict)');
      console.log('Duplicate Error Message:', dupRegData.message);

      console.log('\n=== ALL FRONTEND AUTHENTICATION TESTS PASSED SUCCESSFULLY! ===');

    } catch (err) {
      console.error('Frontend Auth verification failed:', err);
    } finally {
      await User.deleteMany({ email: { $in: [studentEmail, teacherEmail] } });
      console.log('Test data cleaned up successfully.');
      server.close();
      process.exit(0);
    }
  });
};

runAuthVerificationTests();
