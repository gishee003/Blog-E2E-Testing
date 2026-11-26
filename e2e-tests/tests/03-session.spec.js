// Session-data based testing.
//
// The app's whole client-side session is one JWT in localStorage["token"],
// sent as "Authorization: Bearer <token>". Each test changes that session data
// (removes, tampers with, forges, expires, swaps or replays it), then drives
// the UI and checks three things:
//   1. what the server answered (status code),
//   2. how the client reacted (redirect, message, token cleared),
//   3. that the database was not changed.
const { test, expect } = require('@playwright/test');
const { registerUser, createPost } = require('../utils/api');
const { findPost, findPostsByTitle, deleteUser } = require('../utils/db');
const S = require('../utils/session');

const unique = (s) => `${s} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

const isPostCreate = (r) => r.url().endsWith('/api/posts') && r.request().method() === 'POST';
const isPostUpdate = (id) => (r) => r.url().endsWith(`/api/posts/${id}`) && r.request().method() === 'PUT';

// Opens the app on a neutral page and plants the given token.
async function plantToken(page, token) {
  await page.goto('/');
  await S.setToken(page, token);
}

// Fills the new-post form and submits it, returning the API response.
async function submitNewPost(page, title) {
  await page.goto('/posts/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body').fill('session test body');
  const [res] = await Promise.all([
    page.waitForResponse(isPostCreate),
    page.getByRole('button', { name: 'Publish' }).click(),
  ]);
  return res;
}

// After the server rejects the token: back on login and the bad token is gone.
async function expectSessionEnded(page) {
  await expect(page).toHaveURL(/\/login\?session=expired$/);
  expect(await S.getToken(page)).toBeNull();
}

test.describe('Session-data based tests', () => {
  test('TC-SES-01 without a token, protected pages redirect to login', async ({ page }) => {
    const owner = await registerUser('ses1');
    const post = await createPost(owner.token, { title: unique('Guarded'), body: 'x' });

    await page.goto('/posts/new');
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(`/posts/${post._id}/edit`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('nav-login')).toBeVisible();
  });

  test('TC-SES-02 a token whose payload was edited is rejected', async ({ page }) => {
    const attacker = await registerUser('ses2a');
    const victim = await registerUser('ses2v');
    const title = unique('Impersonation');
    await plantToken(page, S.tamperPayload(attacker.token, victim.id));

    const res = await submitNewPost(page, title);

    expect(res.status()).toBe(401);
    await expectSessionEnded(page);
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test('TC-SES-03 an expired token is rejected and the user must log in again', async ({ page }) => {
    const user = await registerUser('ses3');
    const title = unique('Expired');
    await plantToken(page, S.expiredToken(user.id));

    const res = await submitNewPost(page, title);

    expect(res.status()).toBe(401);
    await expectSessionEnded(page);
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test("TC-SES-04 a forged token cannot edit another user's post", async ({ page }) => {
    const victim = await registerUser('ses4');
    const post = await createPost(victim.token, { title: unique('Victim'), body: 'original' });
    await plantToken(page, S.forgedToken(victim.id));

    await page.goto(`/posts/${post._id}/edit`);
    await expect(page.getByLabel('Title')).toHaveValue(post.title); // public GET still works
    await page.getByLabel('Body').fill('defaced');
    const [res] = await Promise.all([
      page.waitForResponse(isPostUpdate(post._id)),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    expect(res.status()).toBe(401);
    await expectSessionEnded(page);
    expect((await findPost(post._id)).body).toBe('original');
  });

  test('TC-SES-05 an unsigned (alg "none") token is rejected', async ({ page }) => {
    const user = await registerUser('ses5');
    const title = unique('Unsigned');
    await plantToken(page, S.unsignedToken(user.id));

    const res = await submitNewPost(page, title);

    expect(res.status()).toBe(401);
    await expectSessionEnded(page);
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test("TC-SES-06 a valid session of user B cannot edit user A's post", async ({ page }) => {
    const a = await registerUser('ses6a');
    const b = await registerUser('ses6b');
    const post = await createPost(a.token, { title: unique('Owned by A'), body: 'A wrote this' });
    await S.loginAs(page, b);

    // B opens the edit URL directly (no Edit button is shown to B).
    await page.goto(`/posts/${post._id}/edit`);
    await page.getByLabel('Body').fill('B was here');
    const [res] = await Promise.all([
      page.waitForResponse(isPostUpdate(post._id)),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    expect(res.status()).toBe(403);
    await expect(page.getByTestId('form-error')).toHaveText('Not authorized to update this post');
    expect(await S.getToken(page)).toBe(b.token); // B's own session is kept
    expect((await findPost(post._id)).body).toBe('A wrote this');
  });

  test('TC-SES-07 the token of a deleted account is rejected with 401', async ({ page }) => {
    const user = await registerUser('ses7');
    const title = unique('Ghost');
    await plantToken(page, user.token);
    await deleteUser(user.id); // account removed while the session is still in the browser

    const res = await submitNewPost(page, title);

    expect(res.status(), 'expected 401 for a token whose user no longer exists').toBe(401);
    await expectSessionEnded(page);
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test('TC-SES-08 a token captured before logout no longer works after logout', async ({ page }) => {
    const user = await registerUser('ses8');
    await S.loginAs(page, user);
    const captured = await S.getToken(page);
    await page.getByTestId('nav-logout').click();
    expect(await S.getToken(page)).toBeNull();

    // Replay the captured session data.
    await S.setToken(page, captured);
    const title = unique('Replayed');
    const res = await submitNewPost(page, title);

    expect(res.status(), 'expected the logged-out token to be revoked').toBe(401);
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test('TC-SES-09 a session survives a reload and is shared with a new tab', async ({ page, context }) => {
    const user = await registerUser('ses9');
    await S.loginAs(page, user);
    await page.reload();
    await expect(page.getByTestId('nav-logout')).toBeVisible();

    const tab2 = await context.newPage();
    await tab2.goto('/posts/new');
    await expect(tab2.getByLabel('Title')).toBeVisible();
    expect(await S.getToken(tab2)).toBe(user.token);
  });

  test('TC-SES-10 sessions in separate browser contexts are isolated', async ({ browser }) => {
    const a = await registerUser('ses10a');
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await S.loginAs(pageA, a);
    await pageB.goto('/');

    await expect(pageA.getByTestId('nav-logout')).toBeVisible();
    await expect(pageB.getByTestId('nav-login')).toBeVisible();
    expect(await S.getToken(pageB)).toBeNull();
    await pageB.goto('/posts/new');
    await expect(pageB).toHaveURL(/\/login$/);

    await ctxA.close();
    await ctxB.close();
  });

  test('TC-SES-11 token removed mid-session (e.g. logout in another tab) blocks the save', async ({ page }) => {
    const user = await registerUser('ses11');
    await S.loginAs(page, user);
    const title = unique('Mid-session');

    await page.goto('/posts/new');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Body').fill('typed before the session ended');
    await S.clearToken(page);
    const [res] = await Promise.all([
      page.waitForResponse(isPostCreate),
      page.getByRole('button', { name: 'Publish' }).click(),
    ]);

    expect(res.status()).toBe(401);
    await expect(page.getByTestId('form-error')).toHaveText('Not authorized, no token');
    await expect(page.getByLabel('Title')).toHaveValue(title); // the user's input is not lost
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test('TC-SES-12 a garbage token is detected on page load and cleared', async ({ page }) => {
    const owner = await registerUser('ses12');
    const post = await createPost(owner.token, { title: unique('Any'), body: 'x' });
    await plantToken(page, 'not-a-jwt');

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/users/me')),
      page.goto(`/posts/${post._id}`),
    ]);

    expect(res.status()).toBe(401);
    await expectSessionEnded(page);
  });
});
