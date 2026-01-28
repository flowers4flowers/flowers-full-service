import { config } from 'dotenv';
config();

import { MongoClient, Db } from 'mongodb';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 5000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

export async function getDb(): Promise<Db> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MONGODB_URI to .env');
  }

  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    
    if (process.env.NODE_ENV === 'development') {
      let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };

      if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect();
      }
      clientPromise = globalWithMongo._mongoClientPromise;
    } else {
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
  }

  const connectedClient = await clientPromise;
  return connectedClient.db();
}

export default clientPromise;