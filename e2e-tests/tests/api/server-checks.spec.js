// API-level checks (no browser). These send requests the UI would normally
// prevent, to confirm the server validates input and protects data on its own.
const { test, expect } = require('@playwright/test');
const { apiContext, registerUser, createPost, newUser } = require('../../utils/api');
const { deleteUser, findPost } = require('../../utils/db');

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const unique = (s) => `${s} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

let api;
test.beforeAll(async () => { api = await apiContext(); });
test.afterAll(async () => { await api.dispose(); });

test.describe('Server-side validation and access control', () => {
  test('TC-API-01 protected endpoints reject requests without a token (401)', async () => {
    const user = await registerUser('api1');
    const post = await createPost(user.token, { title: unique('P'), body: 'x' });
    const calls = [
      api.post('posts', { data: { title: 't', body: 'b' } }),
      api.put(`posts/${post._id}`, { data: { title: 't' } }),
      api.delete(`posts/${post._id}`),
      api.post('comments', { data: { postId: post._id, text: 'hi' } }),
      api.get('users/me'),
      api.put('users/me', { data: { username: 'hijack' } }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status(), res.url()).toBe(401);
    }
    expect((await findPost(post._id)).title).toBe(post.title);
  });

  test('TC-API-02 registration with missing fields returns 400, not 500', async () => {
    const res = await api.post('auth/register', { data: { email: newUser().email } });
    expect(res.status()).toBe(400);
  });

  test('TC-API-03 creating a post with a blank title returns 400, not 500', async () => {
    const user = await registerUser('api3');
    const res = await api.post('posts', { data: { title: '   ', body: 'b' }, headers: auth(user.token) });
    expect(res.status()).toBe(400);
  });

  test('TC-API-04 updating a post with an empty title is rejected, not silently ignored', async () => {
    const user = await registerUser('api4');
    const post = await createPost(user.token, { title: unique('Orig'), body: 'x' });
    const res = await api.put(`posts/${post._id}`, { data: { title: '' }, headers: auth(user.token) });
    expect(res.status()).toBe(400);
  });

  test('TC-API-05 requesting a malformed post id returns 400 or 404, not 500', async () => {
    const res = await api.get('posts/not-an-id');
    expect([400, 404]).toContain(res.status());
  });

  test('TC-API-06 an empty comment returns 400, not 500', async () => {
    const user = await registerUser('api6');
    const post = await createPost(user.token, { title: unique('P'), body: 'x' });
    const res = await api.post('comments', { data: { postId: post._id, text: '' }, headers: auth(user.token) });
    expect(res.status()).toBe(400);
  });

  test('TC-API-07 commenting on a post that does not exist returns 404', async () => {
    const user = await registerUser('api7');
    const res = await api.post('comments', {
      data: { postId: '0123456789abcdef01234567', text: 'orphan' },
      headers: auth(user.token),
    });
    expect(res.status()).toBe(404);
  });

  test('TC-API-08 error responses do not leak stack traces', async () => {
    const user = await registerUser('api8');
    await deleteUser(user.id);
    const res = await api.get('users/me', { headers: auth(user.token) });
    const body = await res.json();
    expect(body.stack, 'stack trace exposed to client').toBeUndefined();
  });

  test('TC-API-09 the user list (with emails) is not public', async () => {
    await registerUser('api9');
    const res = await api.get('users');
    expect(res.status(), 'anonymous request listed every user and email').toBe(401);
  });
});
