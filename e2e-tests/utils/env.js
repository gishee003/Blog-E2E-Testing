// Shared settings for the test run. The servers started by playwright.config.js
// get the same values, so tests can read the DB and sign tokens directly.
module.exports = {
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  API_URL: process.env.API_URL || 'http://localhost:5000',
  MONGO_URI: process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/blog_e2e',
  JWT_SECRET: process.env.E2E_JWT_SECRET || 'e2e-test-secret-do-not-use-in-prod',
};
