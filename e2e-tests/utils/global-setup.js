// Runs once before the suite: start from an empty test database.
const { clearAll, close } = require('./db');

module.exports = async () => {
  await clearAll();
  await close();
};
