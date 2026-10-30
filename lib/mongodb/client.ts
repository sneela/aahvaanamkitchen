import 'server-only';
import { MongoClient, type Db } from 'mongodb';
declare global { var __aahvaanamMongo: Promise<MongoClient> | undefined; }
export const mongoConfigured = () => Boolean(process.env.MONGODB_URI);
export async function mongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (!globalThis.__aahvaanamMongo) {
    globalThis.__aahvaanamMongo = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).connect().catch(error => {
      globalThis.__aahvaanamMongo = undefined;
      throw error;
    });
  }
  return (await globalThis.__aahvaanamMongo).db(process.env.MONGODB_DB_NAME || 'aahvaanam_kitchen');
}
