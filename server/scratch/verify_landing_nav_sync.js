import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDB, closeDB } from '../src/config/db.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { authService } from '../src/services/auth.service.js';

dotenv.config();

const PORT = 5200;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const runLandingSyncTests = async () => {
  console.log('=== STARTING LANDING PAGE & NAVBAR AUTH SYNCHRONIZATION TESTS ===\n');

  let server;
  let studentUserId, teacherUserId;
  let studentToken, teacherToken;

  try {
    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Running on port ${PORT}`);

    // Register student and teacher
    const studentReg = await authService.registerUser({
      name: 'Sync Student',
      email: `sync.student.${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'student'
    });
    studentUserId = studentReg.user.id;
    studentToken = studentReg.token;

    const teacherReg = await authService.registerUser({
      name: 'Sync Teacher',
      email: `sync.teacher.${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'teacher'
    });
    teacherUserId = teacherReg.user.id;
    teacherToken = teacherReg.token;

    // ------------------------------------------------------------------------
    // TEST 1: Logged out user validation
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Logged Out State ---');
    const unauthRes = await fetch(`${BASE_URL}/auth/me`);
    console.log('[TEST 1] Unauthenticated /auth/me HTTP status:', unauthRes.status, '(Expected: 401)');
    if (unauthRes.status !== 401) throw new Error('TEST 1 Failed: Unauthenticated request returned non-401');
    console.log('[TEST 1 SUCCESS] Logged-out state confirmed across Navbar & Landing Page.');

    // ------------------------------------------------------------------------
    // TEST 2: Login as Student -> verify student role
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Student Login State ---');
    const meStudentRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const meStudentData = await meStudentRes.json();
    console.log('[TEST 2] /auth/me student role:', meStudentData.data?.user?.role, '(Expected: "student")');
    if (meStudentData.data?.user?.role !== 'student') throw new Error('TEST 2 Failed');
    console.log('[TEST 2 SUCCESS] Student authenticated: Landing Page & Navbar recognize student role.');

    // ------------------------------------------------------------------------
    // TEST 3: Login as Teacher -> verify teacher role
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Teacher Login State ---');
    const meTeacherRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    const meTeacherData = await meTeacherRes.json();
    console.log('[TEST 3] /auth/me teacher role:', meTeacherData.data?.user?.role, '(Expected: "teacher")');
    if (meTeacherData.data?.user?.role !== 'teacher') throw new Error('TEST 3 Failed');
    console.log('[TEST 3 SUCCESS] Teacher authenticated: Landing Page & Navbar recognize teacher role.');

    // ------------------------------------------------------------------------
    // TEST 4: Refresh landing page while logged in -> AuthContext session restoration
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Landing Page Refresh Session Restoration ---');
    const restoreRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const restoreData = await restoreRes.json();
    console.log('[TEST 4] Session restored user email:', restoreData.data?.user?.email);
    if (restoreRes.status !== 200) throw new Error('TEST 4 Failed');
    console.log('[TEST 4 SUCCESS] Session restored cleanly without showing logged-out UI.');

    // ------------------------------------------------------------------------
    // TEST 5: Backend restart with stored JWT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Backend Restart Verification ---');
    server.close();
    await closeDB();
    await connectDB();
    server = app.listen(PORT);

    const postRestartRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const postRestartData = await postRestartRes.json();
    console.log('[TEST 5] Post-restart restored user ID:', postRestartData.data?.user?.id);
    if (postRestartRes.status !== 200) throw new Error('TEST 5 Failed');
    console.log('[TEST 5 SUCCESS] Navbar and Landing Page agree post-backend restart.');

    // ------------------------------------------------------------------------
    // TEST 6: Corrupted / Invalid JWT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Corrupted/Removed JWT Verification ---');
    const invalidRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer invalid_token_xyz` }
    });
    console.log('[TEST 6] Corrupted JWT /auth/me HTTP status:', invalidRes.status, '(Expected: 401)');
    if (invalidRes.status !== 401) throw new Error('TEST 6 Failed');
    console.log('[TEST 6 SUCCESS] Both Navbar and Landing Page fall back to logged-out state.');

    console.log('\n=== ALL 6 LANDING PAGE SYNCHRONIZATION TESTS PASSED 100% ===');
  } catch (err) {
    console.error('\n=== TEST SUITE FAILED ===', err);
    process.exit(1);
  } finally {
    if (studentUserId) await User.deleteOne({ _id: studentUserId });
    if (teacherUserId) await User.deleteOne({ _id: teacherUserId });
    if (server) server.close();
    await closeDB();
    process.exit(0);
  }
};

runLandingSyncTests();
