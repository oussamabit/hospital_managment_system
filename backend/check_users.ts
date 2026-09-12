
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './src/models/User';

dotenv.config({ path: path.join(__dirname, '.env') });

const checkAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const allUsers = await User.find();
        console.log(`Total users in DB: ${allUsers.length}`);
        allUsers.forEach(u => {
            console.log(`- ${u.email} | Role: ${u.role} | Active: ${u.isActive} | Type: ${(u as any).userType}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

checkAll();
