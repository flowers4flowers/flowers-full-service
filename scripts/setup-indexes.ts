import { getDb } from '../next/utility/db';

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
    console.log('All indexes set up successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up indexes:', error);
    process.exit(1);
  }
}

setupIndexes();