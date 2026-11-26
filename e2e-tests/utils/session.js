// Session-data helpers: read, write and forge the JWT the app keeps in
// localStorage under the key "token".
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./env');

const TOKEN_KEY = 'token';

// Puts a token into localStorage. The page must already be on the app's origin.
async function setToken(page, token) {
  await page.evaluate(([k, t]) => localStorage.setItem(k, t), [TOKEN_KEY, token]);
}

async function getToken(page) {
  return page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
}

async function clearToken(page) {
  await page.evaluate((k) => localStorage.removeItem(k), TOKEN_KEY);
}

// Opens the app and starts a session for an existing user (skips the login form).
async function loginAs(page, user) {
  await page.goto('/');
  await setToken(page, user.token);
  await page.reload();
}

// A token signed with the real secret that has already expired.
function expiredToken(userId) {
  return jwt.sign({ id: userId, iat: Math.floor(Date.now() / 1000) - 7200 }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

// A well-formed token signed with the real secret, for any user id.
function validTokenFor(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

// A token signed with a key the server does not know (forged).
function forgedToken(userId) {
  return jwt.sign({ id: userId }, 'attacker-guessed-secret', { expiresIn: '1h' });
}

// Keeps the original header and signature but swaps the payload to another
// user id, as an attacker editing localStorage by hand would.
function tamperPayload(token, newUserId) {
  const [header, , signature] = token.split('.');
  const payload = Buffer.from(JSON.stringify({ id: newUserId, iat: Math.floor(Date.now() / 1000) }))
    .toString('base64url');
  return `${header}.${payload}.${signature}`;
}

// A token whose payload uses alg "none" with no signature.
function unsignedToken(userId) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ id: userId })}.`;
}

module.exports = {
  TOKEN_KEY,
  setToken,
  getToken,
  clearToken,
  loginAs,
  expiredToken,
  validTokenFor,
  forgedToken,
  tamperPayload,
  unsignedToken,
};
