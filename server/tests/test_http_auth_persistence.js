import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

console.log('=== STARTING HTTP AUTHENTICATION PERSISTENCE TEST ===\n');

const testEmail = `http.auth.${Date.now()}@example.com`;
const testPassword = 'Password123!';

const postJSON = (path, bodyObj) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyObj);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/v1${path}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const runHttpAuthTest = async () => {
  try {
    // 1. Register User via HTTP
    console.log(`--- Step 1: Register User (${testEmail}) via HTTP POST /auth/register ---`);
    const regRes = await postJSON('/auth/register', {
      name: 'HTTP Auth User',
      email: testEmail,
      password: testPassword,
      role: 'student'
    });
    console.log(`Register Status Code: ${regRes.statusCode}`);
    console.log(`Register Response Success: ${regRes.body.success}`);
    console.log(`Register Returned User ID: ${regRes.body.data?.user?._id || regRes.body.data?.user?.id}`);

    if (regRes.statusCode !== 201 || !regRes.body.success) {
      throw new Error(`Registration failed via HTTP: ${JSON.stringify(regRes.body)}`);
    }

    // 2. Immediate Login via HTTP
    console.log(`\n--- Step 2: Immediate Login via HTTP POST /auth/login ---`);
    const loginRes1 = await postJSON('/auth/login', {
      email: testEmail,
      password: testPassword
    });
    console.log(`Immediate Login Status Code: ${loginRes1.statusCode}`);
    console.log(`Immediate Login Response Success: ${loginRes1.body.success}`);
    console.log(`Immediate Login Returned User ID: ${loginRes1.body.data?.user?._id || loginRes1.body.data?.user?.id}`);

    if (loginRes1.statusCode !== 200 || !loginRes1.body.success) {
      throw new Error(`Immediate login failed via HTTP: ${JSON.stringify(loginRes1.body)}`);
    }

    // 3. Test Email Normalization via HTTP (uppercase & whitespace)
    console.log('\n--- Step 3: Test Email Normalization (Uppercase & Whitespace) via HTTP ---');
    const upperRes = await postJSON('/auth/login', {
      email: testEmail.toUpperCase(),
      password: testPassword
    });
    console.log(`Uppercase Email Login Status: ${upperRes.statusCode} (Expected: 200)`);

    const spacedRes = await postJSON('/auth/login', {
      email: `  ${testEmail}  `,
      password: testPassword
    });
    console.log(`Spaced Email Login Status: ${spacedRes.statusCode} (Expected: 200)`);

    if (upperRes.statusCode !== 200 || spacedRes.statusCode !== 200) {
      throw new Error('Email normalization test failed via HTTP');
    }

    // 4. Test Invalid Email & Invalid Password Rejections via HTTP
    console.log('\n--- Step 4: Test Invalid Email & Password Rejections via HTTP ---');
    const badEmailRes = await postJSON('/auth/login', {
      email: 'nonexistent.user@example.com',
      password: testPassword
    });
    console.log(`Nonexistent Email Login Status: ${badEmailRes.statusCode} (Expected: 401)`);
    console.log(`Nonexistent Email Error Message: "${badEmailRes.body.message}"`);

    const badPassRes = await postJSON('/auth/login', {
      email: testEmail,
      password: 'WrongPassword123!'
    });
    console.log(`Wrong Password Login Status: ${badPassRes.statusCode} (Expected: 401)`);
    console.log(`Wrong Password Error Message: "${badPassRes.body.message}"`);

    if (badEmailRes.statusCode !== 401 || badPassRes.statusCode !== 401) {
      throw new Error('Invalid credentials rejection test failed via HTTP');
    }

    console.log('\n=== HTTP AUTHENTICATION PERSISTENCE TEST PASSED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n[HTTP AUTH TEST FAILED]:', err);
    process.exit(1);
  }
};

runHttpAuthTest();
