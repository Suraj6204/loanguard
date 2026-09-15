import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from './config/database';
import { User } from './models/User';
import { UserRole } from './types';

const SEED_USERS = [
  {
    name: 'Admin User',
    email: 'admin@loanguard.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
  },
  {
    name: 'Sales Executive',
    email: 'sales@loanguard.com',
    password: 'Sales@123',
    role: UserRole.SALES,
  },
  {
    name: 'Sanction Officer',
    email: 'sanction@loanguard.com',
    password: 'Sanction@123',
    role: UserRole.SANCTION,
  },
  {
    name: 'Disbursement Officer',
    email: 'disbursement@loanguard.com',
    password: 'Disbursement@123',
    role: UserRole.DISBURSEMENT,
  },
  {
    name: 'Collection Executive',
    email: 'collection@loanguard.com',
    password: 'Collection@123',
    role: UserRole.COLLECTION,
  },
  {
    name: 'Rahul Sharma',
    email: 'borrower@loanguard.com',
    password: 'Borrower@123',
    role: UserRole.BORROWER,
  },
];

async function seed() {
  try {
    await connectDatabase();
    console.log('\n🌱 Seeding database...\n');

    for (const userData of SEED_USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`  ⏭️  ${userData.role.padEnd(15)} | ${userData.email} (already exists)`);
        continue;
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role,
      });

      console.log(`  ✅ ${userData.role.padEnd(15)} | ${userData.email} / ${userData.password}`);
    }

    console.log('\n✅ Seed complete!\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  Seed Credentials                                       ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    SEED_USERS.forEach((u) => {
      console.log(`║  ${u.role.padEnd(15)} | ${u.email.padEnd(30)} | ${u.password.padEnd(10)}║`);
    });
    console.log('╚═══════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

seed();
