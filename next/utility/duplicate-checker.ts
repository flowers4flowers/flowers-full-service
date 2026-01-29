import { Db } from 'mongodb';

/**
 * Checks which content hashes already exist in the database for a given thread.
 * Used to detect and skip duplicate messages when processing forwarded emails.
 * 
 * @param db - MongoDB database instance
 * @param threadId - The thread ID to check within
 * @param contentHashes - Array of content hashes to check for duplicates
 * @returns Array of content hashes that already exist in the database
 */
export async function checkForDuplicates(
  db: Db,
  threadId: string,
  contentHashes: string[]
): Promise<string[]> {
  try {
    // Query for existing documents with matching threadId and contentHash
    const existingDocuments = await db
      .collection('inbound_emails')
      .find({
        threadId,
        contentHash: { $in: contentHashes }
      })
      .project({ contentHash: 1, _id: 0 }) // Only return contentHash field
      .toArray();
    
    // Extract the contentHash values from results
    const existingHashes = existingDocuments
      .map(doc => doc.contentHash)
      .filter(hash => hash !== undefined) as string[];
    
    if (existingHashes.length > 0) {
      console.log(`Found ${existingHashes.length} duplicate messages for thread ${threadId}`);
    }
    
    return existingHashes;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // On error, return empty array (safer to potentially add duplicates than to fail)
    return [];
  }
}