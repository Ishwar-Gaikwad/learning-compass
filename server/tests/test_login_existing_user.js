import http from 'http';

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
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
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

const run = async () => {
  // Login with user created in previous server process session
  const res = await postJSON('/auth/login', {
    email: 'http.auth.1786697097226@example.com',
    password: 'Password123!'
  });
  console.log('Login Status for pre-restart user:', res.statusCode);
  console.log('Login Success:', res.body.success);
  console.log('Logged In User ID:', res.body.data?.user?._id || res.body.data?.user?.id);

  if (res.statusCode === 200 && res.body.success) {
    console.log('\n>>> PERSISTENCE ACROSS RESTART VERIFIED 100% SUCCESSFUL! <<<');
    process.exit(0);
  } else {
    console.error('\n>>> PERSISTENCE TEST FAILED <<<');
    process.exit(1);
  }
};

run();
