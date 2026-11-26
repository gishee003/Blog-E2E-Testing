// Captures the screenshots used in the project report (docs/report/figures).
// Not part of the test suite. Needs the API on :5000 (test DB) and the React
// build on :3000 running, and an HTML report in ./playwright-report.
//   node scripts/capture-report-figures.js
const path = require('path');
const { chromium } = require('@playwright/test');
const { apiContext, createPost, createComment } = require('../utils/api');
const { clearAll, close } = require('../utils/db');
const S = require('../utils/session');
const { APP_URL } = require('../utils/env');

const OUT = path.resolve(__dirname, '../../docs/report/figures');
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });

// Registers a user with a readable name (the test helper adds a random suffix).
async function register(username) {
  const api = await apiContext();
  const res = await api.post('auth/register', {
    data: { username, email: `${username}@example.com`, password: 'Passw0rd!' },
  });
  const body = await res.json();
  await api.dispose();
  return { username, id: body.id, token: body.token };
}

(async () => {
  await clearAll();
  const alice = await register('alice');
  const bob = await register('bob');
  const p1 = await createPost(alice.token, {
    title: 'Getting started with end-to-end testing',
    body: 'End-to-end tests drive the real UI against a real server and database. '
      + 'They catch integration problems that unit tests miss.',
  });
  await createPost(bob.token, {
    title: 'Why session handling matters',
    body: 'Most web apps keep the session in a cookie or in localStorage. '
      + 'If the server trusts that data blindly, users can impersonate each other.',
  });
  await createComment(bob.token, p1._id, 'Great introduction, thanks!');
  await createComment(alice.token, p1._id, 'Glad it helped.');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 }, baseURL: APP_URL });
  const page = await ctx.newPage();

  // Application screens
  await page.goto('/');
  await page.getByText('Why session handling matters').waitFor();
  await shot(page, 'app-home');

  await page.goto('/register');
  await page.getByPlaceholder('Username').fill('carol');
  await page.getByPlaceholder('Email').fill('carol@example.com');
  await page.getByPlaceholder('Password').fill('secret123');
  await shot(page, 'app-register');

  await S.loginAs(page, alice);
  await page.goto(`/posts/${p1._id}`);
  await page.getByTestId('comment').first().waitFor();
  await page.getByTestId('comment-form').waitFor();
  await shot(page, 'app-post-author', { fullPage: true });

  await page.goto(`/posts/${p1._id}/edit`);
  await page.getByLabel('Title').and(page.locator(':enabled')).waitFor();
  await shot(page, 'app-edit-form');

  // Session-data test: valid session of Bob used on Alice's edit page -> 403
  await S.setToken(page, bob.token);
  await page.goto(`/posts/${p1._id}/edit`);
  await page.getByLabel('Body').fill('Bob was here');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByTestId('form-error').waitFor();
  await shot(page, 'ses-403-other-user');

  // Network failure: publish while the API is unreachable
  await S.setToken(page, alice.token);
  await page.route('**/api/posts', (r) => (r.request().method() === 'POST' ? r.abort('connectionrefused') : r.continue()));
  await page.goto('/posts/new');
  await page.getByLabel('Title').fill('Draft written on a train');
  await page.getByLabel('Body').fill('The connection dropped before I could publish.');
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.getByTestId('form-error').waitFor();
  await shot(page, 'net-publish-offline');
  await page.unroute('**/api/posts');

  // Bug: deleting a post fails
  page.once('dialog', (d) => d.accept());
  await page.goto(`/posts/${p1._id}`);
  await page.getByTestId('post-delete').click();
  await page.getByTestId('post-error').waitFor();
  await shot(page, 'bug-delete-post');

  // Bug: home page is silently empty when the API fails
  await page.route('**/api/posts', (r) => r.abort('failed'));
  await page.goto('/');
  await page.getByRole('heading', { name: 'Blog Posts' }).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'bug-home-network');
  await page.unroute('**/api/posts');

  // Playwright HTML report
  const report = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const reportUrl = 'file:///' + path.resolve(__dirname, '../playwright-report/index.html').replace(/\\/g, '/');
  await report.goto(reportUrl);
  await report.getByText('TC-AUTH-01').first().waitFor();
  await shot(report, 'report-overview');
  // Detail page of one failing session-data test (expected vs received).
  await report.getByRole('link', { name: /TC-SES-07/ }).first().click();
  await report.getByText('Expected: 401').first().waitFor();
  await shot(report, 'report-failure-detail');

  await browser.close();
  await close();
  console.log('figures written to', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
