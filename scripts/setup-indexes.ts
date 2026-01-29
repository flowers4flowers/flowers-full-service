import { readFileSync } from 'fs';
import path from 'path';

// Manually load .env file
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
} catch (error) {
  console.error('Error loading .env:', error);
}

import { getDb } from '../next/utility/db.js';

async function setupIndexes() {
  try {
    const db = await getDb();
    
    console.log('Setting up indexes...');
    
    // Indexes for inbound_emails collection
    await db.collection('inbound_emails').createIndex(
      { messageId: 1 }, 
      { unique: true }
    );
    await db.collection('inbound_emails').createIndex({ threadId: 1 });
    await db.collection('inbound_emails').createIndex({ receivedAt: -1 });
    
    // Index for content hash (duplicate detection)
    await db.collection('inbound_emails').createIndex({ contentHash: 1 });
    
    // Compound index for efficient duplicate checking
    await db.collection('inbound_emails').createIndex({ 
      threadId: 1, 
      contentHash: 1 
    });
    
    console.log('✓ inbound_emails indexes created');
    
    // Indexes for email_threads collection
    await db.collection('email_threads').createIndex(
      { threadId: 1 }, 
      { unique: true }
    );
    await db.collection('email_threads').createIndex({ processed: 1 });
    await db.collection('email_threads').createIndex({ processingStatus: 1 });
    await db.collection('email_threads').createIndex({ lastEmailAt: -1 });
    
    console.log('✓ email_threads indexes created');
    
    // Indexes for extracted_deals collection
    await db.collection('extracted_deals').createIndex(
      { threadId: 1 }, 
      { unique: true }
    );
    await db.collection('extracted_deals').createIndex({ extractedAt: -1 });
    await db.collection('extracted_deals').createIndex({ dealStage: 1 });
    await db.collection('extracted_deals').createIndex({ dealOwner: 1 });
    
    console.log('✓ extracted_deals indexes created');
    console.log('All indexes set up successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up indexes:', error);
    process.exit(1);
  }
}

setupIndexes();