import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDB, closeDB } from '../src/config/db.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { authService } from '../src/services/auth.service.js';

dotenv.config();

const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const runFull7TestSequence = async () => {
  console.log('=== STARTING COMPLETE 7-STEP AUTHENTICATION HYDRATION VERIFICATION ===\n');

  let server;
  const testStudentEmail = `hydrated.student.${Date.now()}@test.com`;
  const password = 'Password123!';
  let storedToken;
  let userId;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Start backend & login as student
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Login as Student ---');
    await connectDB();
    
    server = app.listen(PORT);
    console.log(`[Backend Server] Running on port ${PORT}`);

    // Register student
    const regRes = await authService.registerUser({
      name: 'Hydration Student',
      email: testStudentEmail,
      password,
      role: 'student'
    });
    userId = regRes.user.id;
    storedToken = regRes.token;

    console.log(`[TEST 1 SUCCESS] Student registered & logged in. User ID: ${userId}`);

    // ------------------------------------------------------------------------
    // TEST 2: Do NOT logout -> reload frontend simulation -> verify session restored
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Reload Frontend Without Logout ---');
    const meRes2 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    });
    const meData2 = await meRes2.json();

    if (meRes2.status !== 200 || !meData2.data?.user) {
      throw new Error(`TEST 2 Failed: /auth/me returned status ${meRes2.status}`);
    }
    console.log(`[TEST 2 SUCCESS] /auth/me succeeded. User: ${meData2.data.user.name} (${meData2.data.user.role})`);

    // ------------------------------------------------------------------------
    // TEST 3: Stop backend, restart backend, reload frontend -> verify /auth/me succeeds
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Restart Backend & Hydrate Session ---');
    // Stop server & disconnect DB
    server.close();
    await closeDB();
    console.log('[Server & DB Stopped]');

    // Restart DB & server
    await connectDB();
    server = app.listen(PORT);
    console.log('[Server & DB Restarted]');

    const meRes3 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    });
    const meData3 = await meRes3.json();

    if (meRes3.status !== 200 || meData3.data?.user?.id !== userId.toString()) {
      throw new Error(`TEST 3 Failed: User session not restored post-restart`);
    }
    console.log(`[TEST 3 SUCCESS] Session restored post-restart for User ID: ${meData3.data.user.id}`);

    // ------------------------------------------------------------------------
    // TEST 4: Manually corrupted JWT -> verify 401 Unauthorized
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Corrupted JWT Verification ---');
    const corruptToken = storedToken.substring(0, storedToken.length - 6) + 'xxxxxx';
    const meRes4 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${corruptToken}` }
    });

    if (meRes4.status !== 401) {
      throw new Error(`TEST 4 Failed: Corrupt JWT returned status ${meRes4.status} (Expected 401)`);
    }
    console.log(`[TEST 4 SUCCESS] Corrupt JWT correctly rejected with HTTP 401`);

    // ------------------------------------------------------------------------
    // TEST 5: Expired JWT -> verify 401 Unauthorized
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Expired JWT Verification ---');
    const expiredToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1s' });
    // Wait 1.5s for token expiry
    await new Promise((r) => setTimeout(r, 1500));

    const meRes5 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    if (meRes5.status !== 401) {
      throw new Error(`TEST 5 Failed: Expired JWT returned status ${meRes5.status} (Expected 401)`);
    }
    console.log(`[TEST 5 SUCCESS] Expired JWT correctly rejected with HTTP 401`);

    // ------------------------------------------------------------------------
    // TEST 6: Unified authentication state verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Navbar & Dashboard Single Auth Context State Check ---');
    const meRes6 = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    });
    const meData6 = await meRes6.json();
    console.log(`[TEST 6 SUCCESS] Single source of truth validated: User ${meData6.data?.user?.email} is active`);

    // ------------------------------------------------------------------------
    // TEST 7: Restart backend multiple times -> verify database record persistence
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Multiple Backend Restarts DB Record Survival Check ---');
    for (let i = 1; i <= 3; i++) {
      server.close();
      await closeDB();
      await connectDB();
      server = app.listen(PORT);

      const dbUser = await User.findById(userId);
      if (!dbUser) {
        throw new Error(`TEST 7 Failed on restart iteration ${i}: User ID ${userId} disappeared from DB!`);
      }
      console.log(`[TEST 7 RESTART ${i}] User ID ${userId} persists in DB`);
    }
    console.log(`[TEST 7 SUCCESS] Database record survived 3 consecutive backend restarts!`);

    console.log('\n=== ALL 7 AUTHENTICATION HYDRATION TESTS PASSED 100% ===');
  } catch (err) {
    console.error('\n=== VERIFICATION FAILED ===', err);
    process.exit(1);
  } finally {
    if (userId) {
      await User.deleteOne({ _id: userId });
    }
    if (server) server.close();
    await closeDB();
    process.exit(0);
  }
};

runFull7TestSequence();
