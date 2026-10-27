import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const otplib = require('otplib');

const BASE_URL = 'http://127.0.0.1:3000';
const testResults = [];

function recordResult(testName, passed, details = '', error = null) {
  testResults.push({ testName, passed, details, error: error ? String(error) : null });
  const statusMark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusMark}] ${testName}`);
  if (details) console.log(`       Details: ${details}`);
  if (error) console.log(`       Error: ${error.message || error}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  // Parse cookies from set-cookie headers
  const setCookie = res.headers.get('set-cookie') || '';
  const cookies = {};
  if (setCookie) {
    for (const part of setCookie.split(',')) {
      const match = part.trim().match(/^([^=;]+)=([^;]*)/);
      if (match) {
        cookies[match[1]] = match[2];
      }
    }
  }

  return { status: res.status, headers: res.headers, text, data: json, cookies, rawSetCookie: setCookie };
}

function generateRandomUser(prefix = 'user') {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    firstName: 'Test',
    lastName: 'User',
    username: `${prefix}_${rand}`.slice(0, 18),
    email: `${prefix}_${ts}_${rand}@example.com`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
  };
}

async function runTests() {
  console.log('========================================================');
  console.log('TALKIE AUTH & AUTHORIZATION COMPREHENSIVE TEST SUITE');
  console.log('========================================================\n');

  // ==========================================
  // SECTION 1: User Registration (POST /auth/signup)
  // ==========================================
  console.log('--- Section 1: User Registration (Signup) ---');

  const validUser = generateRandomUser('alice');
  try {
    const res = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validUser),
    });
    const results = res.data?.results || res.data;
    if (res.status === 201 && results?.email === validUser.email && results?.username === validUser.username) {
      recordResult('1.1 Successful user registration', true, `User ID: ${results.id}, Email: ${results.email}`);
    } else {
      recordResult('1.1 Successful user registration', false, `Status: ${res.status}, Body: ${res.text}`);
    }
  } catch (err) {
    recordResult('1.1 Successful user registration', false, '', err);
  }

  // 1.2 Duplicate email
  try {
    const dupEmailUser = generateRandomUser('dup_email');
    dupEmailUser.email = validUser.email; // reuse alice's email
    const res = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupEmailUser),
    });
    if (res.status === 409) {
      recordResult('1.2 Duplicate email rejected with 409 Conflict', true, `Status: 409`);
    } else {
      recordResult('1.2 Duplicate email rejected with 409 Conflict', false, `Expected 409, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('1.2 Duplicate email rejected with 409 Conflict', false, '', err);
  }

  // 1.3 Duplicate username
  try {
    const dupUsernameUser = generateRandomUser('dup_user');
    dupUsernameUser.username = validUser.username; // reuse alice's username
    const res = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupUsernameUser),
    });
    if (res.status === 409) {
      recordResult('1.3 Duplicate username rejected with 409 Conflict', true, `Status: 409`);
    } else {
      recordResult('1.3 Duplicate username rejected with 409 Conflict', false, `Expected 409, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('1.3 Duplicate username rejected with 409 Conflict', false, '', err);
  }

  // 1.4 Password confirmation mismatch
  try {
    const mismatchUser = generateRandomUser('mismatch');
    mismatchUser.passwordConfirm = 'DifferentPassword123!';
    const res = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchUser),
    });
    if (res.status === 400) {
      recordResult('1.4 Password confirmation mismatch rejected with 400 Bad Request', true, `Status: 400`);
    } else {
      recordResult('1.4 Password confirmation mismatch rejected with 400 Bad Request', false, `Expected 400, got ${res.status}`);
    }
  } catch (err) {
    recordResult('1.4 Password confirmation mismatch rejected with 400 Bad Request', false, '', err);
  }

  // 1.5 Password too short (< 8 chars)
  try {
    const shortPwUser = generateRandomUser('short');
    shortPwUser.password = '12345';
    shortPwUser.passwordConfirm = '12345';
    const res = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shortPwUser),
    });
    if (res.status === 400) {
      recordResult('1.5 Short password (< 8 chars) rejected with 400 Bad Request', true, `Status: 400`);
    } else {
      recordResult('1.5 Short password (< 8 chars) rejected with 400 Bad Request', false, `Expected 400, got ${res.status}`);
    }
  } catch (err) {
    recordResult('1.5 Short password (< 8 chars) rejected with 400 Bad Request', false, '', err);
  }

  // ==========================================
  // SECTION 2: User Login (POST /auth/login)
  // ==========================================
  console.log('\n--- Section 2: User Login & Token Issuance ---');

  let aliceToken = null;
  let aliceRefreshCookie = null;
  let aliceUserId = null;

  try {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validUser.email,
        password: validUser.password,
      }),
    });
    const results = res.data?.results || res.data;
    aliceToken = results?.access_token;
    aliceRefreshCookie = res.cookies['jwt_refresh'];

    if (res.status === 200 && aliceToken && aliceRefreshCookie) {
      const payload = JSON.parse(Buffer.from(aliceToken.split('.')[1], 'base64').toString('utf8'));
      aliceUserId = payload.sub || payload.id;
      recordResult('2.1 Login succeeds with valid credentials, issuing JWT and refresh cookie', true, `User ID: ${aliceUserId}`);
    } else {
      recordResult('2.1 Login succeeds with valid credentials, issuing JWT and refresh cookie', false, `Status: ${res.status}, Token: ${Boolean(aliceToken)}, Cookie: ${Boolean(aliceRefreshCookie)}`);
    }
  } catch (err) {
    recordResult('2.1 Login succeeds with valid credentials, issuing JWT and refresh cookie', false, '', err);
  }

  // 2.2 Login with wrong password -> 401
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validUser.email,
        password: 'WrongPassword999!',
      }),
    });
    if (res.status === 401) {
      recordResult('2.2 Login with wrong password rejected with 401 Unauthorized', true, `Status: 401`);
    } else {
      recordResult('2.2 Login with wrong password rejected with 401 Unauthorized', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    recordResult('2.2 Login with wrong password rejected with 401 Unauthorized', false, '', err);
  }

  // 2.3 Login with non-existent email -> 401
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody_exists_here_never@example.com',
        password: 'Password123!',
      }),
    });
    if (res.status === 401) {
      recordResult('2.3 Login with non-existent email rejected with 401 Unauthorized', true, `Status: 401`);
    } else {
      recordResult('2.3 Login with non-existent email rejected with 401 Unauthorized', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    recordResult('2.3 Login with non-existent email rejected with 401 Unauthorized', false, '', err);
  }

  // ==========================================
  // SECTION 3: Token Refresh (POST /auth/refresh)
  // ==========================================
  console.log('\n--- Section 3: Token Refresh ---');

  try {
    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `jwt_refresh=${aliceRefreshCookie}`,
      },
    });
    const results = res.data?.results || res.data;
    if (res.status === 200 && results?.access_token) {
      recordResult('3.1 Refresh token endpoint issues new access_token', true, `New token issued successfully`);
    } else {
      recordResult('3.1 Refresh token endpoint issues new access_token', false, `Status: ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('3.1 Refresh token endpoint issues new access_token', false, '', err);
  }

  // 3.2 Refresh without cookie -> 401
  try {
    const res = await request('/auth/refresh', {
      method: 'POST',
    });
    if (res.status === 401) {
      recordResult('3.2 Refresh without jwt_refresh cookie rejected with 401', true, `Status: 401`);
    } else {
      recordResult('3.2 Refresh without jwt_refresh cookie rejected with 401', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    recordResult('3.2 Refresh without jwt_refresh cookie rejected with 401', false, '', err);
  }

  // ==========================================
  // SECTION 4: Authentication & Cache Isolation (GET /users/me)
  // ==========================================
  console.log('\n--- Section 4: Auth Identity & Cache Isolation ---');

  // 4.1 Access protected route without token -> 401
  try {
    const res = await request('/users/me');
    if (res.status === 401) {
      recordResult('4.1 Protected route rejects unauthenticated request with 401', true, `Status: 401`);
    } else {
      recordResult('4.1 Protected route rejects unauthenticated request with 401', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    recordResult('4.1 Protected route rejects unauthenticated request with 401', false, '', err);
  }

  // 4.2 Access protected route with invalid token -> 401
  try {
    const res = await request('/users/me', {
      headers: { Authorization: 'Bearer this.is.invalid.token' },
    });
    if (res.status === 401) {
      recordResult('4.2 Protected route rejects invalid token with 401', true, `Status: 401`);
    } else {
      recordResult('4.2 Protected route rejects invalid token with 401', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    recordResult('4.2 Protected route rejects invalid token with 401', false, '', err);
  }

  // 4.3 Profile Isolation Test: User A calls /users/me, then User B calls /users/me
  // Checks whether CacheInterceptor leaks User A's identity to User B!
  let userB = generateRandomUser('bob');
  let bobToken = null;
  let bobUserId = null;

  try {
    await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB),
    });
    const bobLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userB.email, password: userB.password }),
    });
    bobToken = bobLogin.data?.results?.access_token;
    const bobPayload = JSON.parse(Buffer.from(bobToken.split('.')[1], 'base64').toString('utf8'));
    bobUserId = bobPayload.sub || bobPayload.id;

    // Alice calls /users/me
    const aliceMeRes = await request('/users/me', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const aliceProfile = aliceMeRes.data?.results || aliceMeRes.data;

    // Bob calls /users/me
    const bobMeRes = await request('/users/me', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobProfile = bobMeRes.data?.results || bobMeRes.data;

    if (aliceProfile.email === validUser.email && bobProfile.email === userB.email) {
      recordResult('4.3 User profile /users/me returns caller profile without cross-user cache contamination', true, `Alice got ${aliceProfile.email}, Bob got ${bobProfile.email}`);
    } else {
      recordResult(
        '4.3 User profile /users/me returns caller profile without cross-user cache contamination',
        false,
        `CACHE LEAK DETECTED: Bob called /users/me but received email '${bobProfile.email}' (expected '${userB.email}', Alice was '${validUser.email}')`
      );
    }
  } catch (err) {
    recordResult('4.3 User profile /users/me cache isolation', false, '', err);
  }

  // ==========================================
  // SECTION 5: Password Management (PUT /auth/change-password)
  // ==========================================
  console.log('\n--- Section 5: Password Change ---');

  const userCharlie = generateRandomUser('charlie');
  let charlieToken = null;
  try {
    await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userCharlie),
    });
    const charlieLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userCharlie.email, password: userCharlie.password }),
    });
    charlieToken = charlieLogin.data?.results?.access_token;

    // 5.1 Change password with wrong old password -> 400 or 401
    const badOldRes = await request('/auth/change-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oldPassword: 'IncorrectOldPassword123!',
        newPassword: 'BrandNewPassword456!',
        newPasswordConfirm: 'BrandNewPassword456!',
      }),
    });

    if (badOldRes.status === 400 || badOldRes.status === 401) {
      recordResult('5.1 Password change rejects incorrect oldPassword', true, `Status: ${badOldRes.status}`);
    } else {
      recordResult('5.1 Password change rejects incorrect oldPassword', false, `Expected 400/401, got ${badOldRes.status}`);
    }

    // 5.2 Change password with same password as oldPassword -> 400 Bad Request
    const samePassRes = await request('/auth/change-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oldPassword: userCharlie.password,
        newPassword: userCharlie.password,
        newPasswordConfirm: userCharlie.password,
      }),
    });

    if (samePassRes.status === 400) {
      recordResult('5.2 Password change rejects newPassword matching oldPassword', true, `Status: 400`);
    } else {
      recordResult('5.2 Password change rejects newPassword matching oldPassword', false, `Expected 400, got ${samePassRes.status}`);
    }

    // 5.3 Valid password change
    const newSecret = 'SuperSecureNewPass789!';
    const changeRes = await request('/auth/change-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oldPassword: userCharlie.password,
        newPassword: newSecret,
        newPasswordConfirm: newSecret,
      }),
    });

    if (changeRes.status === 200) {
      recordResult('5.3 Password changed successfully', true, `Status: 200`);

      // 5.4 Old password should now fail login -> 401
      const oldLoginRes = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userCharlie.email, password: userCharlie.password }),
      });

      if (oldLoginRes.status === 401) {
        recordResult('5.4 Login with old password rejected with 401', true, `Status: 401`);
      } else {
        recordResult('5.4 Login with old password rejected with 401', false, `Expected 401, got ${oldLoginRes.status}`);
      }

      // 5.5 New password should succeed login -> 200
      const newLoginRes = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userCharlie.email, password: newSecret }),
      });

      if (newLoginRes.status === 200 && (newLoginRes.data?.results?.access_token || newLoginRes.data?.access_token)) {
        recordResult('5.5 Login with new password succeeds with 200', true, `Status: 200`);
      } else {
        recordResult('5.5 Login with new password succeeds with 200', false, `Expected 200, got ${newLoginRes.status}`);
      }
    } else {
      recordResult('5.3 Password changed successfully', false, `Status: ${changeRes.status}, body: ${changeRes.text}`);
    }
  } catch (err) {
    recordResult('5.X Password change suite error', false, '', err);
  }

  // ==========================================
  // SECTION 6: User Logout (POST /auth/logout)
  // ==========================================
  console.log('\n--- Section 6: User Logout ---');

  try {
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        Cookie: `jwt_refresh=${aliceRefreshCookie}`,
      },
    });

    if (logoutRes.status === 200 && logoutRes.rawSetCookie.includes('jwt_refresh=;')) {
      recordResult('6.1 Logout clears refresh cookie', true, `jwt_refresh cookie cleared`);
    } else {
      recordResult('6.1 Logout clears refresh cookie', false, `Status: ${logoutRes.status}, rawSetCookie: ${logoutRes.rawSetCookie}`);
    }
  } catch (err) {
    recordResult('6.1 Logout clears refresh cookie', false, '', err);
  }

  // ==========================================
  // SECTION 7: Two-Factor Authentication (2FA)
  // ==========================================
  console.log('\n--- Section 7: Two-Factor Authentication (2FA) ---');

  const tfaUser = generateRandomUser('tfa_test');
  let tfaToken = null;
  let tfaSecret = null;

  try {
    await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tfaUser),
    });
    const tfaLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tfaUser.email, password: tfaUser.password }),
    });
    tfaToken = tfaLogin.data?.results?.access_token;

    // 7.1 Initiate 2FA -> returns OTP URI
    const initRes = await request('/auth/tfa/initiate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tfaToken}` },
    });
    const initData = initRes.data?.results || initRes.data;
    const uri = initData?.uri;

    if (initRes.status === 201 && uri && uri.startsWith('otpauth://totp/')) {
      recordResult('7.1 Initiate 2FA returns TOTP setup URI', true, `URI: ${uri.slice(0, 40)}...`);
      // Parse secret from URI: otpauth://totp/...secret=XXXX&...
      const match = uri.match(/[?&]secret=([A-Z0-9]+)/i);
      tfaSecret = match ? match[1] : null;
    } else {
      recordResult('7.1 Initiate 2FA returns TOTP setup URI', false, `Status: ${initRes.status}, body: ${initRes.text}`);
    }

    // 7.2 Enable 2FA with invalid code -> 401
    const badCodeRes = await request('/auth/tfa/enable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tfaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tfaToken: '000000' }),
    });

    if (badCodeRes.status === 401) {
      recordResult('7.2 Enable 2FA with invalid TOTP code rejected with 401', true, `Status: 401`);
    } else {
      recordResult('7.2 Enable 2FA with invalid TOTP code rejected with 401', false, `Expected 401, got ${badCodeRes.status}`);
    }

    // 7.3 Enable 2FA with valid TOTP code
    if (tfaSecret) {
      const validTotpCode = await otplib.generate({ secret: tfaSecret });
      const enableRes = await request('/auth/tfa/enable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tfaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tfaToken: validTotpCode }),
      });

      if (enableRes.status === 200 || enableRes.status === 201) {
        recordResult('7.3 Enable 2FA with valid TOTP code succeeds', true, `Status: ${enableRes.status}`);

        // 7.4 Login when 2FA enabled returns tfaRequired and tfaLoginToken
        const loginTfaRes = await request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: tfaUser.email, password: tfaUser.password }),
        });
        const loginTfaData = loginTfaRes.data?.results || loginTfaRes.data;

        if (loginTfaRes.status === 200 && loginTfaData?.tfaRequired === true && loginTfaData?.tfaLoginToken) {
          recordResult('7.4 Login on 2FA-enabled account requires 2FA token', true, `tfaRequired: true, loginToken received`);

          // 7.5 Verify 2FA code to complete login
          const verifyCode = await otplib.generate({ secret: tfaSecret });
          const verifyRes = await request('/auth/tfa/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${loginTfaData.tfaLoginToken}`,
            },
            body: JSON.stringify({
              tfaToken: verifyCode,
            }),
          });
          const verifyData = verifyRes.data?.results || verifyRes.data;

          if (verifyRes.status === 200 && verifyData?.access_token) {
            recordResult('7.5 2FA verification completes login with new access_token', true, `Access token received`);
          } else {
            recordResult('7.5 2FA verification completes login with new access_token', false, `Status: ${verifyRes.status}, body: ${verifyRes.text}`);
          }
        } else {
          recordResult('7.4 Login on 2FA-enabled account requires 2FA token', false, `Status: ${loginTfaRes.status}, body: ${loginTfaRes.text}`);
        }
      } else {
        recordResult('7.3 Enable 2FA with valid TOTP code succeeds', false, `Status: ${enableRes.status}, body: ${enableRes.text}`);
      }
    } else {
      recordResult('7.3 Enable 2FA with valid TOTP code succeeds', false, 'Secret could not be extracted from URI');
    }
  } catch (err) {
    recordResult('7.X 2FA suite error', false, '', err);
  }

  // ==========================================
  // SECTION 8: System Authorization (AppRole: Admin vs User)
  // ==========================================
  console.log('\n--- Section 8: System-Level Authorization (AppRole) ---');

  // 8.1 Regular user accessing admin endpoint (GET /access-control/resolveApp) -> 403 Forbidden
  try {
    const res = await request('/access-control/resolveApp', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    if (res.status === 403) {
      recordResult('8.1 Regular user accessing @RequireAppRole(Admin) rejected with 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('8.1 Regular user accessing @RequireAppRole(Admin) rejected with 403 Forbidden', false, `Expected 403, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('8.1 Regular user accessing @RequireAppRole(Admin) rejected with 403 Forbidden', false, '', err);
  }

  // 8.2 Regular user accessing GET /users (Admin only) -> 403 Forbidden
  try {
    const res = await request('/users', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    if (res.status === 403) {
      recordResult('8.2 Regular user accessing GET /users (Admin only) rejected with 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('8.2 Regular user accessing GET /users (Admin only) rejected with 403 Forbidden', false, `Expected 403, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('8.2 Regular user accessing GET /users (Admin only) rejected with 403 Forbidden', false, '', err);
  }

  // ==========================================
  // SECTION 9: Server-Level Authorization (CASL & Server Permissions)
  // ==========================================
  console.log('\n--- Section 9: Server & Channel Authorization ---');

  // 9.1 Create server by User Bob
  let serverBob = null;
  let generalChannel = null;
  try {
    const sRes = await request('/servers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: `Auth Perm Server ${Date.now()}` }),
    });
    serverBob = sRes.data?.results || sRes.data;

    const chRes = await request(`/channels/server/${serverBob.id}/visible/${bobUserId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const channels = chRes.data?.results || chRes.data;
    generalChannel = channels[0];
  } catch (err) {
    console.error('Server setup error:', err);
  }

  // 9.2 Server Owner accessing @RequireServerPermissions(Administrator) -> Allowed (200)
  try {
    const res = await request(`/access-control/resolveServer/${bobUserId}/${serverBob.id}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    if (res.status === 200) {
      recordResult('9.1 Server Owner has Administrator permission (200 OK)', true, `Status: 200`);
    } else {
      recordResult('9.1 Server Owner has Administrator permission (200 OK)', false, `Expected 200, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('9.1 Server Owner has Administrator permission (200 OK)', false, '', err);
  }

  // 9.3 Non-member user accessing Server Admin endpoint -> 403 Forbidden
  try {
    const nonMember = generateRandomUser('stranger');
    await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nonMember),
    });
    const strangerLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nonMember.email, password: nonMember.password }),
    });
    const strangerToken = strangerLogin.data?.results?.access_token;
    const strangerId = JSON.parse(Buffer.from(strangerToken.split('.')[1], 'base64').toString('utf8')).sub;

    const res = await request(`/access-control/resolveServer/${strangerId}/${serverBob.id}`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
    });

    if (res.status === 403) {
      recordResult('9.2 Non-member of server accessing server-guarded endpoint rejected with 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('9.2 Non-member of server accessing server-guarded endpoint rejected with 403 Forbidden', false, `Expected 403, got ${res.status}: ${res.text}`);
    }

    // 9.4 Non-member attempting to upload file to server channel -> rejected (403 or 404)
    const uploadForm = new FormData();
    uploadForm.append('channelId', generalChannel.id);
    uploadForm.append('files', new Blob(['test'], { type: 'text/plain' }), 'test.txt');

    const uploadRes = await request('/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${strangerToken}` },
      body: uploadForm,
    });

    if (uploadRes.status === 403) {
      recordResult('9.3 Non-member attempting file upload to server channel rejected with 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('9.3 Non-member attempting file upload to server channel rejected with 403 Forbidden', false, `Expected 403, got ${uploadRes.status}: ${uploadRes.text}`);
    }
  } catch (err) {
    recordResult('9.X Server permission tests error', false, '', err);
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n========================================================');
  console.log('AUTH & AUTHORIZATION TEST RESULTS SUMMARY:');
  console.log('========================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFAILED TESTS:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(` - ${r.testName}: ${r.details || r.error}`);
      });
  }
}

runTests().catch((err) => {
  console.error('FATAL TEST SUITE ERROR:', err);
  process.exit(1);
});
