// Run this once to create all default users:
//   node seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const USERS = [
  { name: 'Admin',     username: 'admin',    password: 'admin123',   role: 'admin'   },
  { name: 'Staff 1',   username: 'staff1',   password: 'staff123',   role: 'staff'   },
  { name: 'Packer 1',  username: 'packer1',  password: 'packer123',  role: 'packing' },
  { name: 'Counter 1', username: 'counter1', password: 'counter123', role: 'counter' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  for (const u of USERS) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      existing.password = u.password; // triggers bcrypt hash in pre-save hook
      existing.role = u.role;
      existing.isActive = true;
      await existing.save();
      console.log(`Updated: ${u.username}`);
    } else {
      await User.create(u);
      console.log(`Created: ${u.username}`);
    }
  }

  console.log('\nDone! Login credentials:');
  console.log('  Admin:   admin    / admin123');
  console.log('  Staff:   staff1   / staff123');
  console.log('  Packing: packer1  / packer123');
  console.log('  Counter: counter1 / counter123');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
