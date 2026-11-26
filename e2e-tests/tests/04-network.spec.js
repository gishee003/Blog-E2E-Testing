// Network failure tests: the API is unreachable, slow, offline or returns errors.
// Simulated with page.route() and context.setOffline().
const { test, expect } = require('@playwright/test');
const { registerUser, createPost } = require('../utils/api');
const { findPost, findPostsByTitle, findCommentsByText } = require('../utils/db');
const { loginAs, getToken } = require('../utils/session');

const unique = (s) => `${s} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const NETWORK_MSG = 'Network error: could not reach the server. Please try again.';

test.describe('Network failures', () => {
  test('TC-NET-01 publishing while the API is unreachable shows an error and keeps the draft', async ({ page }) => {
    const user = await registerUser('net1');
    await loginAs(page, user);
    const title = unique('Unsent');
    await page.route('**/api/posts', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionrefused') : route.continue()
    );

    await page.goto('/posts/new');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Body').fill('draft');
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByTestId('form-error')).toHaveText(NETWORK_MSG);
    await expect(page).toHaveURL(/\/posts\/new$/);
    await expect(page.getByLabel('Title')).toHaveValue(title);
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled();
    expect(await findPostsByTitle(title)).toHaveLength(0);
  });

  test('TC-NET-02 commenting while offline fails cleanly and works after reconnecting', async ({ page, context }) => {
    const user = await registerUser('net2');
    const post = await createPost(user.token, { title: unique('Offline'), body: 'x' });
    await loginAs(page, user);
    await page.goto(`/posts/${post._id}`);
    await expect(page.getByTestId('comment-form')).toBeVisible();
    const text = unique('offline comment');

    await context.setOffline(true);
    await page.getByLabel('Comment').fill(text);
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByTestId('comment-error')).toHaveText(NETWORK_MSG);
    expect(await findCommentsByText(text)).toHaveLength(0);

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByTestId('comment').filter({ hasText: text })).toBeVisible();
    expect(await findCommentsByText(text)).toHaveLength(1);
  });

  test('TC-NET-03 home page tells the user when posts cannot be loaded', async ({ page }) => {
    await page.route('**/api/posts', (route) => route.abort('failed'));
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Blog Posts' })).toBeVisible();
    await expect(
      page.getByText(/error|could not|unable|failed|try again/i),
      'expected a visible error instead of an empty list'
    ).toBeVisible();
  });

  test('TC-NET-04 slow API: the publish button is disabled while saving, so no duplicates', async ({ page }) => {
    const user = await registerUser('net4');
    await loginAs(page, user);
    const title = unique('Slow');
    await page.route('**/api/posts', async (route) => {
      if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.goto('/posts/new');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Body').fill('slow network');
    const button = page.getByRole('button', { name: 'Publish' });
    await button.click();

    const saving = page.getByRole('button', { name: 'Saving…' });
    await expect(saving).toBeDisabled();
    await saving.click({ force: true }).catch(() => {}); // impatient second click
    await expect(page).toHaveURL(/\/posts\/[a-f0-9]{24}$/, { timeout: 10_000 });
    expect(await findPostsByTitle(title)).toHaveLength(1);
  });

  test('TC-NET-05 login when the server fails with 500 shows the error and creates no session', async ({ page }) => {
    const user = await registerUser('net5');
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Database unavailable"}' })
    );
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(user.email);
    await page.getByPlaceholder('Password').fill(user.password);

    const dialog = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Login' }).click();
    const d = await dialog;
    expect(d.message()).toBe('Database unavailable');
    await d.accept();

    await expect(page).toHaveURL(/\/login$/);
    expect(await getToken(page)).toBeNull();
  });

  // Uses a dropped connection on the login request rather than context.setOffline():
  // in Chromium, closing the alert while the whole context is offline hangs
  // Playwright. Full offline mode is covered by TC-NET-02.
  test('TC-NET-06 login when the connection drops shows a failure message', async ({ page }) => {
    const user = await registerUser('net6');
    await page.route('**/api/auth/login', (route) => route.abort('internetdisconnected'));
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(user.email);
    await page.getByPlaceholder('Password').fill(user.password);

    const dialog = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Login' }).click();
    const d = await dialog;
    expect(d.message()).toBe('Login failed');
    await d.accept();

    await expect(page).toHaveURL(/\/login$/);
    expect(await getToken(page)).toBeNull();
  });

  test('TC-NET-07 a 503 while saving an edit is reported and the post is unchanged', async ({ page }) => {
    const user = await registerUser('net7');
    const post = await createPost(user.token, { title: unique('Stable'), body: 'unchanged' });
    await loginAs(page, user);
    await page.route(`**/api/posts/${post._id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Service unavailable"}' })
        : route.continue()
    );

    await page.goto(`/posts/${post._id}/edit`);
    await expect(page.getByLabel('Title')).toHaveValue(post.title);
    await page.getByLabel('Body').fill('changed');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByTestId('form-error')).toHaveText('Service unavailable');
    await expect(page).toHaveURL(/\/edit$/);
    expect((await findPost(post._id)).body).toBe('unchanged');
  });
});
