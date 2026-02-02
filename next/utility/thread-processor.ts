import { getDb } from './db';
import { cleanEmailBody } from './email-cleaner';
import { extractDealData, ExtractedDealData } from './deal-extractor';

interface EmailDocument {
  _id: any;
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

/**
 * Main processing function that:
 * 1. Fetches all emails for a thread
 * 2. Cleans each email using AI
 * 3. Combines cleaned emails
 * 4. Extracts deal data using AI
 * 5. Saves to extracted_deals collection
 * 6. Marks thread as processed
 */
export async function processThread(threadId: string): Promise<void> {
  console.log(`\n========================================`);
  console.log(`PROCESSING THREAD: ${threadId}`);
  console.log(`========================================\n`);

  try {
    const db = await getDb();

    // Fetch all emails for this thread, ordered by receivedAt
    console.log('Fetching emails from database...');
    const emails = await db
      .collection('inbound_emails')
      .find({ threadId })
      .sort({ receivedAt: 1 }) // Oldest first
      .toArray() as EmailDocument[];

    if (emails.length === 0) {
      console.log('No emails found for this thread');
      return;
    }

    console.log(`Found ${emails.length} emails in thread`);

    // Clean each email using AI
    console.log('\n--- Cleaning emails with AI ---');
    const cleanedEmails: Array<{ from: string; cleaned: string }> = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`\nCleaning email ${i + 1}/${emails.length} from ${email.from}`);
      console.log('Original body length:', email.body.length);

      try {
        const cleaned = await cleanEmailBody(email.body);
        console.log('Cleaned body length:', cleaned.length);
        console.log('Cleaned preview:', cleaned.substring(0, 200));

        cleanedEmails.push({
          from: email.from,
          cleaned: cleaned
        });
      } catch (error) {
        console.error(`Error cleaning email ${i + 1}:`, error);
        // If cleaning fails, use original body
        cleanedEmails.push({
          from: email.from,
          cleaned: email.body
        });
      }
    }

    // Combine cleaned emails into formatted thread
    console.log('\n--- Combining cleaned emails ---');
    const combinedThread = cleanedEmails
      .map((email, index) => `Email ${index + 1} from ${email.from}:\n${email.cleaned}`)
      .join('\n\n');

    console.log('Combined thread length:', combinedThread.length);
    console.log('Combined thread preview:', combinedThread.substring(0, 500));

    // Extract deal data using AI
    console.log('\n--- Extracting deal data with AI ---');
    let extractedData: ExtractedDealData;
    
    try {
      extractedData = await extractDealData(combinedThread);
      console.log('Extracted deal data:', JSON.stringify(extractedData, null, 2));
    } catch (error) {
      console.error('Error extracting deal data:', error);
      throw error;
    }

    // Get unique participants (excluding @fullservice.art emails)
    console.log('\n--- Processing participants ---');
    const allParticipants = new Set<string>();
    emails.forEach(email => {
      if (!email.from.includes('@fullservice.art')) {
        allParticipants.add(email.from);
      }
      if (!email.to.includes('@fullservice.art')) {
        allParticipants.add(email.to);
      }
    });

    const associatedPeople = Array.from(allParticipants);
    console.log('Associated people (excluding @fullservice.art):', associatedPeople);

    // Convert date strings to Date objects
    const shootDate = extractedData.shootDate ? new Date(extractedData.shootDate) : null;

    // Prepare document for extracted_deals collection
    const dealDocument = {
      threadId,
      dealName: extractedData.dealName,
      dealStage: 'Lead' as const,
      dealOwner: 'cait@fullservice.art',
      associatedPeople,
      associatedCompanies: extractedData.associatedCompanies,
      dealValue: extractedData.dealValue,
      budgetRange: extractedData.budgetRange,
      inquirySource: extractedData.inquirySource,
      collaboratorsNeeded: extractedData.collaboratorsNeeded,
      location: extractedData.location,
      shootDate,
      usageTerms: extractedData.usageTerms,
      extractedAt: new Date()
    };

    console.log('\n--- Saving to extracted_deals collection ---');
    const insertResult = await db.collection('extracted_deals').insertOne(dealDocument);
    console.log('Inserted deal with _id:', insertResult.insertedId);

    // Mark thread as processed
    console.log('\n--- Marking thread as processed ---');
    await db.collection('email_threads').updateOne(
      { threadId },
      { 
        $set: { 
          processed: true,
          processedAt: new Date()
        } 
      }
    );

    console.log('\n========================================');
    console.log('PROCESSING COMPLETE');
    console.log(`========================================\n`);
  } catch (error) {
    console.error('\n========================================');
    console.error('PROCESSING FAILED');
    console.error('Error:', error);
    console.error(`========================================\n`);
    
    // On error, thread remains processed: false so it can be retried
    throw error;
  }
}