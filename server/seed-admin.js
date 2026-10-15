// Usage:
//   node seed-admin.js promote <email>      grant admin to one existing account
//   ADMIN_PASSWORD=... node seed-admin.js create <email> <name>
//                                            create the first admin account
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const User = require('./models/User');

const [command, rawEmail, ...nameParts] = process.argv.slice(2);
const email = rawEmail?.toLowerCase();

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!['promote', 'create'].includes(command) || !email) {
  fail('Usage: node seed-admin.js promote <email> | ADMIN_PASSWORD=... node seed-admin.js create <email> <name>');
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket-club');

  if (command === 'promote') {
    const result = await User.updateOne({ email }, { $addToSet: { roles: { $each: ['admin', 'scorer'] } } });
    if (!result.matchedCount) fail(`No user with email ${email}`);
    console.log(`${email} is now an admin.`);
  } else {
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 12) fail('Set ADMIN_PASSWORD (at least 12 characters).');
    if (await User.exists({ email })) fail(`A user with email ${email} already exists; use "promote".`);
    await User.create({
      name: nameParts.join(' ') || 'Club Admin',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      roles: ['admin', 'scorer', 'player']
    });
    console.log(`Admin ${email} created.`);
  }
  await mongoose.disconnect();
};

run().catch((err) => fail(err.message));
