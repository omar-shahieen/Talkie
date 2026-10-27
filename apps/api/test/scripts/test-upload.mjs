import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';

// Minimal 1x1 transparent PNG
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid PDF
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n',
  'utf8'
);

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, data: json };
}

async function main() {
  console.log('=== TALKIE FILE UPLOAD END-TO-END TEST SUITE ===\n');

  // 1. Health check
  console.log('1. Checking api health...');
  const health = await request('/health');
  if (health.status !== 200) {
    throw new Error(`api healthcheck failed: ${health.status} ${health.text}`);
  }
  console.log('   api is healthy!\n');

  // 2. Sign up and login
  const timestamp = Date.now();
  const testUser = {
    firstName: 'Upload',
    lastName: 'Tester',
    username: `uploader_${timestamp}`,
    email: `uploader_${timestamp}@example.com`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
  };

  console.log(`2. Registering test user (${testUser.username})...`);
  const signupRes = await request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });

  if (signupRes.status !== 201 && signupRes.status !== 200) {
    throw new Error(`Signup failed (${signupRes.status}): ${signupRes.text}`);
  }
  console.log('   User registered successfully.');

  console.log('   Logging in to obtain JWT access token...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUser.email,
      password: testUser.password,
    }),
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed (${loginRes.status}): ${loginRes.text}`);
  }

  const token = loginRes.data.results?.access_token || loginRes.data.access_token;
  if (!token) {
    throw new Error(`No access token returned: ${JSON.stringify(loginRes.data)}`);
  }
  console.log('   Authentication token received.\n');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // Decode user id from JWT payload
  const payloadBase64 = token.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
  const userId = payload.sub || payload.id;
  console.log(`   Authenticated as User ID: ${userId}`);

  // 3. Create a server and get general channel
  console.log('3. Creating test server...');
  const serverRes = await request('/servers', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Upload Test Server ${timestamp}`,
      description: 'Server for upload testing',
    }),
  });

  if (serverRes.status !== 201 && serverRes.status !== 200) {
    throw new Error(`Server creation failed: ${serverRes.status} ${serverRes.text}`);
  }

  const server = serverRes.data.results || serverRes.data;
  const serverId = server.id;
  console.log(`   Server created with ID: ${serverId}`);

  console.log('   Retrieving server channels...');
  const channelsRes = await request(`/channels/server/${serverId}/visible/${userId}`, {
    headers: authHeaders,
  });

  const channels = channelsRes.data.results || channelsRes.data;
  const channel = channels.find((c) => c.name === 'general') || channels[0];
  if (!channel) {
    throw new Error(`No channel found in server: ${JSON.stringify(channelsRes.data)}`);
  }
  const channelId = channel.id;
  console.log(`   Using channel: "${channel.name}" (${channelId})\n`);

  // 4. Test Single Image Upload
  console.log('4. Testing image upload (arbitrary PNG -> compressed to WebP and uploaded to bucket)...');
  const imgForm = new FormData();
  imgForm.append('channelId', channelId);
  imgForm.append(
    'files',
    new Blob([MINIMAL_PNG], { type: 'image/png' }),
    'avatar-test.png'
  );

  const imgUploadRes = await request('/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: imgForm,
  });

  if (imgUploadRes.status !== 201 && imgUploadRes.status !== 200) {
    throw new Error(`Image upload failed (${imgUploadRes.status}): ${imgUploadRes.text}`);
  }

  const imgResults = imgUploadRes.data.results || imgUploadRes.data;
  console.log('   Upload response:', JSON.stringify(imgResults, null, 2));

  const imgAttachment = imgResults.attachments[0];
  if (!imgAttachment || !imgAttachment.url) {
    throw new Error('Image attachment missing in response');
  }

  console.log(`   Verifying object in bucket via public URL: ${imgAttachment.url} ...`);
  const imgFetch = await fetch(imgAttachment.url);
  console.log(`   Bucket GET status: ${imgFetch.status} ${imgFetch.statusText}`);
  console.log(`   Bucket Content-Type: ${imgFetch.headers.get('content-type')}`);
  console.log(`   Bucket Content-Length: ${imgFetch.headers.get('content-length')} bytes`);

  if (!imgFetch.ok) {
    throw new Error(`Failed to fetch uploaded image from bucket: ${imgFetch.status}`);
  }
  console.log('   Image upload and bucket verification SUCCESSFUL!\n');

  // 5. Test Non-Image File Upload (Arbitrary text file)
  console.log('5. Testing non-image document upload (arbitrary text file)...');
  const textContent = `Hello Talkie Cloudflare R2 Bucket! Generated at ${new Date().toISOString()}`;
  const textForm = new FormData();
  textForm.append('channelId', channelId);
  textForm.append(
    'files',
    new Blob([Buffer.from(textContent, 'utf8')], { type: 'text/plain' }),
    'readme-notes.txt'
  );

  const textUploadRes = await request('/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: textForm,
  });

  if (textUploadRes.status !== 201 && textUploadRes.status !== 200) {
    throw new Error(`Text upload failed (${textUploadRes.status}): ${textUploadRes.text}`);
  }

  const textResults = textUploadRes.data.results || textUploadRes.data;
  console.log('   Upload response:', JSON.stringify(textResults, null, 2));

  const textAttachment = textResults.attachments[0];
  console.log(`   Verifying object in bucket via public URL: ${textAttachment.url} ...`);
  const textFetch = await fetch(textAttachment.url);
  const fetchedText = await textFetch.text();
  console.log(`   Bucket GET status: ${textFetch.status}`);
  console.log(`   Content-Disposition: ${textFetch.headers.get('content-disposition')}`);
  console.log(`   Fetched body matches uploaded: ${fetchedText === textContent}`);

  if (fetchedText !== textContent) {
    throw new Error('Downloaded text does not match uploaded text!');
  }
  console.log('   Text document upload and bucket verification SUCCESSFUL!\n');

  // 6. Test Multi-file Upload (PDF + Text file together)
  console.log('6. Testing multi-file upload (batch upload of PDF and text file in single request)...');
  const multiForm = new FormData();
  multiForm.append('channelId', channelId);
  multiForm.append(
    'files',
    new Blob([MINIMAL_PDF], { type: 'application/pdf' }),
    'sample-document.pdf'
  );
  multiForm.append(
    'files',
    new Blob([Buffer.from('second arbitrary file content', 'utf8')], { type: 'text/plain' }),
    'second-file.txt'
  );

  const multiUploadRes = await request('/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: multiForm,
  });

  if (multiUploadRes.status !== 201 && multiUploadRes.status !== 200) {
    throw new Error(`Multi upload failed (${multiUploadRes.status}): ${multiUploadRes.text}`);
  }

  const multiResults = multiUploadRes.data.results || multiUploadRes.data;
  console.log('   Upload response count:', multiResults.count);
  for (const att of multiResults.attachments) {
    console.log(`   - File: ${att.fileName} (${att.mimeType}, ${att.sizeBytes} bytes) -> URL: ${att.url}`);
    const res = await fetch(att.url);
    if (!res.ok) throw new Error(`Failed to fetch attachment from bucket: ${att.url}`);
    console.log(`     Verified bucket fetch HTTP ${res.status}`);
  }
  console.log('   Multi-file upload and bucket verification SUCCESSFUL!\n');

  // 7. Security / Validation tests
  console.log('7. Testing security & validation restrictions...');

  // 7.1 Blocked file extension (.exe)
  console.log('   7.1 Testing blocked dangerous extension (.exe)...');
  const dangerousForm = new FormData();
  dangerousForm.append('channelId', channelId);
  dangerousForm.append(
    'files',
    new Blob([Buffer.from('MZ...binary')], { type: 'application/octet-stream' }),
    'malware.exe'
  );

  const dangerousRes = await request('/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: dangerousForm,
  });

  console.log(`   Response status: ${dangerousRes.status} (expected 400 Bad Request)`);
  console.log(`   Response body:`, dangerousRes.text);
  if (dangerousRes.status !== 400) {
    throw new Error(`Expected status 400 for .exe file, got ${dangerousRes.status}`);
  }
  console.log('   Blocked extension correctly rejected!\n');

  // 7.2 Non-existent channel ID
  console.log('   7.2 Testing unauthorized / non-existent channel upload...');
  const fakeChannelForm = new FormData();
  fakeChannelForm.append('channelId', '00000000-0000-0000-0000-000000000000');
  fakeChannelForm.append(
    'files',
    new Blob([Buffer.from('test', 'utf8')], { type: 'text/plain' }),
    'test.txt'
  );

  const fakeRes = await request('/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: fakeChannelForm,
  });

  console.log(`   Response status: ${fakeRes.status} (expected 404 NotFound)`);
  if (fakeRes.status !== 404) {
    throw new Error(`Expected status 404 for non-existent channel, got ${fakeRes.status}`);
  }
  console.log('   Non-existent channel correctly rejected!\n');

  console.log('====================================================');
  console.log('ALL TESTS PASSED: File upload to bucket works as expected!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('\nTEST FAILED WITH ERROR:', err);
  process.exit(1);
});
