import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './src/config/db.js';
import { User } from './src/models/User.js';
import { authService } from './src/services/auth.service.js';

dotenv.config();

const runAuthDiagnostic = async () => {
  console.log('=== STARTING DIAGNOSTIC AUTHENTICATION PERSISTENCE TEST ===\n');

  // Step 1: Initial Database Connection
  const conn = await connectDB();
  console.log(`[DB STEP 1] Host: ${conn.connection.host}, Name: ${conn.connection.name}, Collection: ${User.collection.name}`);

  const testEmail = `auth.test.${Date.now()}@example.com`;
  const rawPassword = 'Password123!';

  try {
    // Step 2: Register fresh user
    console.log(`\n--- Step 2: Registering User: ${testEmail} ---`);
    const regResult = await authService.registerUser({
      name: 'Auth Test User',
      email: testEmail,
      password: rawPassword,
      role: 'student'
    });
    console.log(`[REGISTER SUCCESS] User ID: ${regResult.user.id}, Email: ${regResult.user.email}`);

    // Step 3: Immediate User Lookup & Password Hash Inspection
    console.log('\n--- Step 3: Immediate User Lookup & Hash Check ---');
    const user1 = await User.findOne({ email: testEmail.toLowerCase().trim() }).select('+password');
    console.log('[IMMEDIATE LOOKUP]', {
      found: Boolean(user1),
      id: user1?._id?.toString(),
      email: user1?.email,
      hasPassword: Boolean(user1?.password),
      passwordHashPrefix: user1?.password ? user1.password.substring(0, 10) : 'none'
    });

    if (!user1 || !user1.password) {
      throw new Error('Immediate lookup failed: user or password missing!');
    }

    const match1 = await bcrypt.compare(rawPassword, user1.password);
    console.log(`[IMMEDIATE BCRYPT MATCH]: ${match1}`);
    if (!match1) {
      throw new Error('Immediate bcrypt compare failed!');
    }

    // Step 4: Login via authService immediately
    const login1 = await authService.loginUser({ email: testEmail, password: rawPassword });
    console.log(`[IMMEDIATE AUTH SERVICE LOGIN]: SUCCESS, User ID: ${login1.user.id}`);

    // Step 5: Simulate Server Restart / Re-connect Database
    console.log('\n--- Step 5: Simulating Server Restart (Disconnect & Reconnect DB) ---');
    await mongoose.disconnect();
    console.log('[DB DISCONNECTED]');

    // Re-connect
    const conn2 = await connectDB();
    console.log(`[DB STEP 5 RE-CONNECTED] Host: ${conn2.connection.host}, Name: ${conn2.connection.name}`);

    // Step 6: Post-Restart User Lookup & Password Hash Inspection (CASE A / B / C / D check)
    console.log('\n--- Step 6: Post-Restart User Lookup & Hash Check ---');
    const normalizedEmail = testEmail.trim().toLowerCase();
    const user2 = await User.findOne({ email: normalizedEmail }).select('+password');

    console.log('[POST-RESTART LOOKUP]', {
      found: Boolean(user2),
      id: user2?._id?.toString(),
      email: user2?.email,
      hasPassword: Boolean(user2?.password),
      passwordHashPrefix: user2?.password ? user2.password.substring(0, 10) : 'none'
    });

    let caseName = 'UNKNOWN';
    if (!user2) {
      caseName = 'CASE A: user found = false (Database/User lookup problem)';
    } else if (!user2.password) {
      caseName = 'CASE B: user found = true, hasPassword = false (Password projection problem)';
    } else {
      const match2 = await bcrypt.compare(rawPassword, user2.password);
      console.log(`[POST-RESTART BCRYPT MATCH]: ${match2}`);
      if (!match2) {
        caseName = 'CASE C: user found = true, hasPassword = true, bcrypt = false (Stored hash & candidate password mismatch)';
      } else {
        caseName = 'CASE D: user found = true, hasPassword = true, bcrypt = true (Lookup & bcrypt valid!)';
      }
    }

    console.log(`\n>>> DIAGNOSTIC RESULT: ${caseName}`);

    // Step 7: Test Uppercase & Whitespace Email Normalization
    console.log('\n--- Step 7: Testing Email Normalization Variations ---');
    const upperEmail = testEmail.toUpperCase();
    const spacedEmail = `   ${testEmail}   `;

    const loginUpper = await authService.loginUser({ email: upperEmail, password: rawPassword });
    console.log(`[UPPERCASE EMAIL LOGIN]: SUCCESS (User ID: ${loginUpper.user.id})`);

    const loginSpaced = await authService.loginUser({ email: spacedEmail, password: rawPassword });
    console.log(`[SPACED EMAIL LOGIN]: SUCCESS (User ID: ${loginSpaced.user.id})`);

    // Step 8: Test Error Handling for Invalid Email / Invalid Password
    console.log('\n--- Step 8: Testing Invalid Email & Password Rejections ---');
    let badEmailErr = null;
    try {
      await authService.loginUser({ email: 'nonexistent.user@example.com', password: rawPassword });
    } catch (err) {
      badEmailErr = err;
    }
    console.log(`[NONEXISTENT EMAIL ERROR]: ${badEmailErr?.statusCode} - ${badEmailErr?.message}`);

    let badPassErr = null;
    try {
      await authService.loginUser({ email: testEmail, password: 'WrongPassword123!' });
    } catch (err) {
      badPassErr = err;
    }
    console.log(`[WRONG PASSWORD ERROR]: ${badPassErr?.statusCode} - ${badPassErr?.message}`);

    // Cleanup test user
    await User.deleteOne({ email: testEmail.toLowerCase().trim() });
    await mongoose.disconnect();

    console.log('\n=== DIAGNOSTIC AUTHENTICATION TEST COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[DIAGNOSTIC TEST FAILED]:', err);
    process.exit(1);
  }
};

runAuthDiagnostic();
