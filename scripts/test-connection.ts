import { config } from 'dotenv';
config();

import { getDb } from '../next/utility/db';

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    
    const db = await getDb();
    
    console.log('✓ Connected to MongoDB');
    console.log('Database name:', db.databaseName);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Test inserting a document
    console.log('\nTesting insert...');
    const testDoc = {
      test: true,
      timestamp: new Date()
    };
    await db.collection('test').insertOne(testDoc);
    console.log('✓ Test document inserted');
    
    // Clean up test document
    await db.collection('test').deleteMany({ test: true });
    console.log('✓ Test document cleaned up');
    
    console.log('\nConnection test successful!');
    process.exit(0);
  } catch (error) {
    console.error('Connection test failed:', error);
    process.exit(1);
  }
}

testConnection();