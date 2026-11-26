// Form validation errors and edge-case input in the UI.
const { test, expect } = require('@playwright/test');
const { registerUser, createPost } = require('../utils/api');
const { findPost, findPostsByTitle, findCommentsByText } = require('../utils/db');
const { loginAs } = require('../utils/session');

const unique = (s) => `${s} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// Counts write requests (POST/PUT/DELETE) the page sends to the API.
function countWrites(page) {
  const counter = { n: 0 };
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() !== 'GET') counter.n += 1;
  });
  return counter;
}

test.describe('Form validation and edge cases', () => {
  test('TC-VAL-01 a post with an empty title or body cannot be submitted', async ({ page }) => {
    const user = await registerUser('val1');
    await loginAs(page, user);
    const writes = countWrites(page);
    await page.goto('/posts/new');
    const publish = page.getByRole('button', { name: 'Publish' });

    await publish.click();
    expect(await page.getByLabel('Title').evaluate((el) => el.validity.valueMissing)).toBe(true);

    await page.getByLabel('Title').fill('Title only');
    await publish.click();
    expect(await page.getByLabel('Body').evaluate((el) => el.validity.valueMissing)).toBe(true);

    await expect(page).toHaveURL(/\/posts\/new$/);
    expect(writes.n).toBe(0);
  });

  test('TC-VAL-02 a whitespace-only title is rejected with a message and nothing is saved', async ({ page }) => {
    const user = await registerUser('val2');
    await loginAs(page, user);
    const body = unique('whitespace title body');
    await page.goto('/posts/new');

    await page.getByLabel('Title').fill('     ');
    await page.getByLabel('Body').fill(body);
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByTestId('form-error')).toBeVisible();
    await expect(page).toHaveURL(/\/posts\/new$/);
    expect(await findPostsByTitle('')).toHaveLength(0);
  });

  test('TC-VAL-03 the title field accepts at most 150 characters', async ({ page }) => {
    const user = await registerUser('val3');
    await loginAs(page, user);
    await page.goto('/posts/new');

    await page.getByLabel('Title').pressSequentially('x'.repeat(160));

    expect((await page.getByLabel('Title').inputValue()).length).toBe(150);
  });

  test('TC-VAL-04 clearing the title while editing is blocked and the post is unchanged', async ({ page }) => {
    const user = await registerUser('val4');
    const post = await createPost(user.token, { title: unique('Keep me'), body: 'x' });
    await loginAs(page, user);
    const writes = countWrites(page);
    await page.goto(`/posts/${post._id}/edit`);
    await expect(page.getByLabel('Title')).toHaveValue(post.title);

    await page.getByLabel('Title').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();

    expect(await page.getByLabel('Title').evaluate((el) => el.validity.valueMissing)).toBe(true);
    expect(writes.n).toBe(0);
    expect((await findPost(post._id)).title).toBe(post.title);
  });

  test('TC-VAL-05 a whitespace-only comment is not saved', async ({ page }) => {
    const user = await registerUser('val5');
    const post = await createPost(user.token, { title: unique('Comments'), body: 'x' });
    await loginAs(page, user);
    await page.goto(`/posts/${post._id}`);

    await page.getByLabel('Comment').fill('   ');
    await page.getByRole('button', { name: 'Add comment' }).click();

    await expect(page.getByTestId('comment')).toHaveCount(0);
    expect(await findCommentsByText('   ')).toHaveLength(0);
  });

  test('TC-VAL-06 a malformed post id in the URL shows an error page', async ({ page }) => {
    await page.goto('/posts/not-a-real-id');
    await expect(page.getByTestId('post-error')).toBeVisible();
  });

  test('TC-VAL-07 a post that does not exist shows "Post not found"', async ({ page }) => {
    await page.goto('/posts/0123456789abcdef01234567');
    await expect(page.getByTestId('post-error')).toHaveText('Post not found');
  });
});
