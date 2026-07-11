// One-time script to create your first admin account.
// Run with: node seedAdmin.js "Admin Name" "AdminPassword123"
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seedAdmin() {
  const [, , name, password] = process.argv;

  if (!name || !password) {
    console.error('Usage: node seedAdmin.js "Admin Name" "AdminPassword123"');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ name });
  if (existing) {
    console.log(`User "${name}" already exists with role "${existing.role}".`);
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`Updated "${name}" to role "admin".`);
    }
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name, password: hashedPassword, role: 'admin' });
    console.log(`Created admin user "${name}".`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
