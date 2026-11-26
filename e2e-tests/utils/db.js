// Direct MongoDB access, used to check that UI actions really changed the database.
const { MongoClient, ObjectId } = require('mongodb');
const { MONGO_URI } = require('./env');

let client;

async function db() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db();
}

async function close() {
  if (client) await client.close();
  client = undefined;
}

// Empty every collection. Collections are not dropped, so the unique indexes
// Mongoose created on startup (username, email) stay in place.
async function clearAll() {
  const d = await db();
  for (const c of await d.listCollections().toArray()) {
    await d.collection(c.name).deleteMany({});
  }
}

const oid = (id) => new ObjectId(String(id));

module.exports = {
  db,
  close,
  clearAll,
  oid,
  findUserByEmail: async (email) => (await db()).collection('users').findOne({ email }),
  countUsersByEmail: async (email) => (await db()).collection('users').countDocuments({ email }),
  deleteUser: async (id) => (await db()).collection('users').deleteOne({ _id: oid(id) }),
  findPost: async (id) => (await db()).collection('posts').findOne({ _id: oid(id) }),
  findPostsByTitle: async (title) => (await db()).collection('posts').find({ title }).toArray(),
  findComment: async (id) => (await db()).collection('comments').findOne({ _id: oid(id) }),
  findCommentsByText: async (text) => (await db()).collection('comments').find({ text }).toArray(),
};
