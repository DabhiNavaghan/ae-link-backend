import mongoose, { Connection } from 'mongoose';
import { Logger } from './logger';

const logger = Logger.child({ module: 'mongodb' });

interface MongooseCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

declare global {
  var mongooseCache: MongooseCache;
}

const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * MongoDB connection singleton for serverless environments.
 * Reuses connections across Lambda invocations.
 */
export async function connectDB(): Promise<Connection> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Return cached connection if available
  if (cached.conn) {
    logger.debug('Using cached MongoDB connection');
    return cached.conn;
  }

  // Return pending promise if connection in progress
  if (cached.promise) {
    logger.debug('Waiting for pending MongoDB connection');
    return cached.promise;
  }

  // Create new connection
  cached.promise = mongoose
    .connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
    })
    .then((mongoose) => {
      logger.info('MongoDB connected successfully');
      cached.conn = mongoose.connection;
      return mongoose.connection;
    })
    .catch((error) => {
      logger.error({ error: error.message }, 'MongoDB connection failed');
      cached.promise = null;
      throw error;
    });

  return cached.promise;
}

/**
 * Disconnect from MongoDB (useful for cleanup in tests)
 */
export async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    logger.info('MongoDB disconnected');
  }
}

/**
 * Get current connection status
 */
export function getDBConnectionStatus(): string {
  if (!cached.conn) return 'disconnected';
  return cached.conn.readyState === 1 ? 'connected' : 'disconnected';
}

export default connectDB;
