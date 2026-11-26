// Critical workflow: creating, editing and deleting posts and comments, with
// every change checked in the database.
const { test, expect } = require('@playwright/test');
const { registerUser, createPost, createComment, newUser } = require('../utils/api');
const { findPost, findPostsByTitle, findComment, findCommentsByText, oid } = require('../utils/db');
const { loginAs } = require('../utils/session');

const unique = (s) => `${s} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function writePost(page, title, body) {
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Body').fill(body);
}

test.describe('Posts and comments', () => {
  test('TC-POST-01 logged-in user creates a post and it is saved with them as author', async ({ page }) => {
    const user = await registerUser('author');
    await loginAs(page, user);
    const title = unique('My first post');

    await page.getByTestId('nav-new-post').click();
    await writePost(page, title, 'Hello from Playwright.');
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page).toHaveURL(/\/posts\/[a-f0-9]{24}$/);
    await expect(page.getByTestId('post-title')).toHaveText(title);
    await expect(page.getByTestId('post-author')).toHaveText(user.username);

    const rows = await findPostsByTitle(title);
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('Hello from Playwright.');
    expect(String(rows[0].author)).toBe(user.id);

    await page.goto('/');
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  });

  test('TC-POST-02 author edits their post and the database is updated', async ({ page }) => {
    const user = await registerUser('editor');
    const post = await createPost(user.token, { title: unique('Draft'), body: 'Old body' });
    await loginAs(page, user);
    const newTitle = unique('Final');

    await page.goto(`/posts/${post._id}`);
    await page.getByTestId('post-edit').click();
    await expect(page.getByLabel('Title')).toHaveValue(post.title);
    await writePost(page, newTitle, 'New body');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(new RegExp(`/posts/${post._id}$`));
    await expect(page.getByTestId('post-title')).toHaveText(newTitle);
    const row = await findPost(post._id);
    expect(row.title).toBe(newTitle);
    expect(row.body).toBe('New body');
    expect(row.updatedAt.getTime()).toBeGreaterThan(row.createdAt.getTime());
  });

  test('TC-POST-03 other users and visitors do not get edit/delete controls', async ({ page }) => {
    const author = await registerUser('owner');
    const other = await registerUser('other');
    const post = await createPost(author.token, { title: unique('Owned'), body: 'x' });

    await page.goto(`/posts/${post._id}`);
    await expect(page.getByTestId('post-title')).toBeVisible();
    await expect(page.getByTestId('post-edit')).toHaveCount(0);

    await loginAs(page, other);
    await page.goto(`/posts/${post._id}`);
    await expect(page.getByTestId('post-title')).toBeVisible();
    await expect(page.getByTestId('comment-form')).toBeVisible(); // user data loaded
    await expect(page.getByTestId('post-edit')).toHaveCount(0);
    await expect(page.getByTestId('post-delete')).toHaveCount(0);
  });

  test('TC-POST-04 author deletes their post and it is removed from the database', async ({ page }) => {
    const user = await registerUser('deleter');
    const post = await createPost(user.token, { title: unique('To delete'), body: 'bye' });
    await loginAs(page, user);
    await page.goto(`/posts/${post._id}`);

    page.once('dialog', (d) => d.accept());
    await page.getByTestId('post-delete').click();

    await expect(page.getByTestId('post-error')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    expect(await findPost(post._id)).toBeNull();
  });

  test('TC-POST-05 logged-in user adds a comment and it is saved', async ({ page }) => {
    const author = await registerUser('poster');
    const reader = await registerUser('reader');
    const post = await createPost(author.token, { title: unique('Discuss'), body: 'Thoughts?' });
    await loginAs(page, reader);
    const text = unique('Great post');

    await page.goto(`/posts/${post._id}`);
    await page.getByLabel('Comment').fill(text);
    await page.getByRole('button', { name: 'Add comment' }).click();

    const item = page.getByTestId('comment').filter({ hasText: text });
    await expect(item).toBeVisible();
    await expect(item).toContainText(reader.username);
    await expect(page.getByLabel('Comment')).toHaveValue('');
    const rows = await findCommentsByText(text);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].post)).toBe(post._id);
    expect(String(rows[0].author)).toBe(reader.id);
  });

  test('TC-POST-06 user deletes their own comment and it is removed', async ({ page }) => {
    const user = await registerUser('commenter');
    const post = await createPost(user.token, { title: unique('C'), body: 'x' });
    const comment = await createComment(user.token, post._id, unique('remove me'));
    await loginAs(page, user);
    await page.goto(`/posts/${post._id}`);

    await page.getByTestId('comment').filter({ hasText: comment.text }).getByTestId('comment-delete').click();

    await expect(page.getByTestId('comment-error')).toHaveCount(0);
    await expect(page.getByTestId('comment').filter({ hasText: comment.text })).toHaveCount(0);
    expect(await findComment(comment._id)).toBeNull();
  });

  test('TC-POST-07 full journey: register, login, publish, edit, comment, logout', async ({ page }) => {
    const user = newUser('journey');
    const title = unique('Journey');

    await page.goto('/register');
    await page.getByPlaceholder('Username').fill(user.username);
    await page.getByPlaceholder('Email').fill(user.email);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByPlaceholder('Email').fill(user.email);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByTestId('nav-logout')).toBeVisible();

    await page.getByTestId('nav-new-post').click();
    await writePost(page, title, 'v1');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByTestId('post-title')).toHaveText(title);
    const postId = page.url().split('/').pop();

    await page.getByTestId('post-edit').click();
    await expect(page.getByLabel('Body')).toHaveValue('v1');
    await page.getByLabel('Body').fill('v2');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('post-body')).toHaveText('v2');

    await page.getByLabel('Comment').fill('first!');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByTestId('comment')).toHaveCount(1);

    await page.getByTestId('nav-logout').click();
    await page.goto(`/posts/${postId}`);
    await expect(page.getByTestId('post-body')).toHaveText('v2');
    await expect(page.getByTestId('comment-form')).toHaveCount(0);

    const row = await findPost(oid(postId));
    expect(row.body).toBe('v2');
  });
});
