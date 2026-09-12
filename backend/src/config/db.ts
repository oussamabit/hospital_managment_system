import mongoose from 'mongoose';
import logger from './logger';

const connectDB = async (retryCount = 0): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_rdv';
  const MAX_RETRIES = 5;

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error (Attempt ${retryCount + 1}/${MAX_RETRIES}): ${error}`);
    
    if (retryCount < MAX_RETRIES - 1) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
      logger.info(`Retrying connection in ${delay / 1000} seconds...`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      logger.error('Max connection retries reached. Exiting...');
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error: ${err}`);
});

export default connectDB;
