import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import { comparePassword } from './src/utils/password';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_rdv';

async function checkUsers() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find().select('-password');
    console.log(`Found ${users.length} users:`);
    users.forEach(u => {
        console.log(`- ${u.email} (${u.role}) - isActive: ${u.isActive} - createdAt: ${u.createdAt}`);
    });

    await mongoose.connection.close();
}

checkUsers();
