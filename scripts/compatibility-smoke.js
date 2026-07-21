'use strict';

const assert = require('assert');

const baseUrl = process.env.BASE_URL || 'https://mokshita-final-release.onrender.com/api';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

(async () => {
  const health = await request('/health');
  assert.strictEqual(health.response.status, 200, 'Health check should respond with 200');

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Compatibility Tester',
      email: 'compatibility-tester@example.com',
      password: 'Password123!',
    }),
  });
  assert.notStrictEqual(signup.response.status, 404, 'Signup alias should be available');

  const logout = await request('/api/auth/logout', { method: 'POST' });
  assert.notStrictEqual(logout.response.status, 404, 'Logout route should be available');

  console.log('Smoke test completed successfully');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
