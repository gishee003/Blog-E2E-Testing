// Shortcuts that set up test data through the REST API instead of the UI, so
// each test only drives the UI for the behaviour it is actually testing.
const { request } = require('@playwright/test');
const { API_URL } = require('./env');

let counter = 0;

// A user with unique username/email for this run.
function newUser(prefix = 'user') {
  counter += 1;
  const tag = `${prefix}${Date.now().toString(36)}${counter}`;
  return { username: tag, email: `${tag}@e2e.test`, password: 'Passw0rd!' };
}

async function apiContext() {
  return request.newContext({ baseURL: `${API_URL}/api/` });
}

// Registers a user and returns { ...user, id, token }.
async function registerUser(prefix) {
  const user = newUser(prefix);
  const api = await apiContext();
  const res = await api.post('auth/register', { data: user });
  if (res.status() !== 201) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await api.dispose();
  return { ...user, id: body.id, token: body.token };
}

async function createPost(token, post) {
  const api = await apiContext();
  const res = await api.post('posts', {
    data: post,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 201) throw new Error(`create post failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await api.dispose();
  return body;
}

async function createComment(token, postId, text) {
  const api = await apiContext();
  const res = await api.post('comments', {
    data: { postId, text },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 201) throw new Error(`create comment failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await api.dispose();
  return body;
}

module.exports = { newUser, apiContext, registerUser, createPost, createComment };
