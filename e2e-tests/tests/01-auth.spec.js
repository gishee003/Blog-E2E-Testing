// Workflow: user registration, login and logout.
const { test, expect } = require('@playwright/test');
const { newUser, registerUser } = require('../utils/api');
const { findUserByEmail, countUsersByEmail } = require('../utils/db');
const { getToken } = require('../utils/session');

// The original Login/Register pages report errors with window.alert().
async function nextAlert(page) {
  const dialog = await page.waitForEvent('dialog');
  const message = dialog.message();
  await dialog.accept();
  return message;
}

async function fillRegister(page, user) {
  await page.goto('/register');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
}

async function fillLogin(page, email, password) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
}

test.describe('Registration and authentication', () => {
  test('TC-AUTH-01 new user can register and is stored with a hashed password', async ({ page }) => {
    const user = newUser('reg');
    await fillRegister(page, user);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page).toHaveURL(/\/login$/);
    const dbUser = await findUserByEmail(user.email);
    expect(dbUser, 'user row created').not.toBeNull();
    expect(dbUser.username).toBe(user.username);
    expect(dbUser.password).not.toBe(user.password);
    expect(dbUser.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
  });

  test('TC-AUTH-02 registered user can log in and receives a session token', async ({ page }) => {
    const user = await registerUser('login');
    await fillLogin(page, user.email, user.password);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('nav-logout')).toBeVisible();
    const token = await getToken(page);
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test('TC-AUTH-03 login with a wrong password is rejected', async ({ page }) => {
    const user = await registerUser('badpw');
    await fillLogin(page, user.email, 'wrong-password');
    const alert = nextAlert(page);
    await page.getByRole('button', { name: 'Login' }).click();

    expect(await alert).toBe('Invalid credentials');
    await expect(page).toHaveURL(/\/login$/);
    expect(await getToken(page)).toBeNull();
  });

  test('TC-AUTH-04 registering an email that already exists is rejected', async ({ page }) => {
    const existing = await registerUser('dup');
    await fillRegister(page, { ...newUser('dup2'), email: existing.email });
    const alert = nextAlert(page);
    await page.getByRole('button', { name: 'Register' }).click();

    expect(await alert).toBe('User already exists');
    await expect(page).toHaveURL(/\/register$/);
    expect(await countUsersByEmail(existing.email)).toBe(1);
  });

  test('TC-AUTH-05 logout removes the session token', async ({ page }) => {
    const user = await registerUser('logout');
    await fillLogin(page, user.email, user.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByTestId('nav-logout')).toBeVisible();

    await page.getByTestId('nav-logout').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('nav-login')).toBeVisible();
    expect(await getToken(page)).toBeNull();
  });

  test('TC-AUTH-06 empty and malformed registration fields are blocked by the form', async ({ page }) => {
    let apiCalls = 0;
    page.on('request', (r) => r.url().includes('/api/auth/register') && apiCalls++);
    await page.goto('/register');
    const register = page.getByRole('button', { name: 'Register' });

    // All empty
    await register.click();
    expect(await page.getByPlaceholder('Username').evaluate((el) => el.validity.valueMissing)).toBe(true);

    // Malformed email
    await page.getByPlaceholder('Username').fill('someone');
    await page.getByPlaceholder('Email').fill('not-an-email');
    await page.getByPlaceholder('Password').fill('secret');
    await register.click();
    expect(await page.getByPlaceholder('Email').evaluate((el) => el.validity.typeMismatch)).toBe(true);

    await expect(page).toHaveURL(/\/register$/);
    expect(apiCalls, 'no register request sent').toBe(0);
  });
});
