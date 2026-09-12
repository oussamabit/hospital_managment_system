
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './src/models/User';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkPending = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const pendingUsers = await User.find({ isActive: false });
        console.log(`Found ${pendingUsers.length} pending users:`);
        pendingUsers.forEach(u => console.log(`- ${u.email} (${u.role})`));

        const allUsers = await User.find();
        console.log(`Total users in DB: ${allUsers.length}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

checkPending();
