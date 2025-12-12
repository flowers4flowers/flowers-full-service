// Load environment variables from .env file for local testing
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    console.log('dotenv not installed, using environment variables directly');
  }
}

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ENGAGEMENT_STATUS_SLUG = process.env.ENGAGEMENT_STATUS_SLUG || 'engagement_status';
const LAST_INTERACTION_SLUG = process.env.LAST_INTERACTION_SLUG || 'last_interaction';
const ATTIO_BASE_URL = 'https://api.attio.com/v2';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
const RATE_LIMIT_DELAY_MS = parseInt(process.env.RATE_LIMIT_DELAY_MS || '100', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

// Date thresholds in days
const ACTIVE_THRESHOLD_DAYS = 60;
const COLD_THRESHOLD_DAYS = 180;

// Validate required environment variables
if (!ATTIO_API_KEY) {
  console.error('ERROR: ATTIO_API_KEY environment variable is required');
  process.exit(1);
}

// Helper function to make API requests
async function attioRequest(endpoint, options = {}) {
  const url = `${ATTIO_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${ATTIO_API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error.message);
    throw error;
  }
}

// Helper function to pause execution
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all records of a given type with pagination
async function fetchRecords(objectType) {
  console.log(`Fetching all ${objectType} records...`);
  const allRecords = [];
  let offset = 0;
  const limit = 500;
  
  while (true) {
    try {
      const response = await attioRequest(`/objects/${objectType}/records/query`, {
        method: 'POST',
        body: JSON.stringify({
          limit,
          offset
        })
      });
      
      const records = response.data || [];
      allRecords.push(...records);
      
      console.log(`  Fetched ${records.length} records (total so far: ${allRecords.length})`);
      
      if (records.length < limit) {
        break;
      }
      
      offset += limit;
    } catch (error) {
      console.error(`Failed to fetch records at offset ${offset}:`, error.message);
      break;
    }
  }
  
  console.log(`Total ${objectType} records fetched: ${allRecords.length}`);
  return allRecords;
}

// Extract the last interaction date from a record
function extractLastInteractionDate(record) {
  try {
    const lastInteractionValues = record.values[LAST_INTERACTION_SLUG];
    
    if (!lastInteractionValues || lastInteractionValues.length === 0) {
      return null;
    }
    
    const activeValue = lastInteractionValues.find(v => v.active_until === null);
    
    if (!activeValue || !activeValue.interacted_at) {
      return null;
    }
    
    return new Date(activeValue.interacted_at);
  } catch (error) {
    console.error(`Error extracting last interaction date:`, error.message);
    return null;
  }
}

// Calculate engagement status based on last interaction date
function calculateEngagementStatus(lastInteractionDate) {
  if (!lastInteractionDate) {
    return 'Dormant';
  }
  
  const now = new Date();
  const daysDifference = Math.floor((now - lastInteractionDate) / (1000 * 60 * 60 * 24));
  
  if (daysDifference <= ACTIVE_THRESHOLD_DAYS) {
    return 'Active';
  } else if (daysDifference <= COLD_THRESHOLD_DAYS) {
    return 'Cold';
  } else {
    return 'Dormant';
  }
}

// Get current engagement status from a record
function getCurrentEngagementStatus(record) {
  try {
    const engagementStatusValues = record.values[ENGAGEMENT_STATUS_SLUG];
    
    if (!engagementStatusValues || engagementStatusValues.length === 0) {
      return null;
    }
    
    const activeValue = engagementStatusValues.find(v => v.active_until === null);
    
    if (!activeValue) {
      return null;
    }
    
    return activeValue.option || activeValue.value || activeValue;
  } catch (error) {
    console.error(`Error extracting current engagement status:`, error.message);
    return null;
  }
}

// Update a single record's engagement status
async function updateRecordEngagementStatus(objectType, recordId, newStatus) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would update ${recordId} to ${newStatus}`);
    return true;
  }
  
  try {
    await attioRequest(`/objects/${objectType}/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          values: {
            [ENGAGEMENT_STATUS_SLUG]: newStatus
          }
        }
      })
    });
    
    return true;
  } catch (error) {
    console.error(`  Failed to update record ${recordId}:`, error.message);
    return false;
  }
}

// Process a batch of records
async function processRecords(records, objectType) {
  const stats = {
    skipped: 0,
    updated: 0,
    failed: 0,
    unchanged: 0
  };
  
  let updatesSinceLastPause = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordId = record.id.record_id;
    
    if ((i + 1) % 100 === 0) {
      console.log(`Progress: ${i + 1}/${records.length} records processed`);
    }
    
    try {
      const currentStatus = getCurrentEngagementStatus(record);
      
      if (currentStatus === 'Prospecting') {
        stats.skipped++;
        continue;
      }
      
      const lastInteractionDate = extractLastInteractionDate(record);
      const newStatus = calculateEngagementStatus(lastInteractionDate);
      
      if (currentStatus === newStatus) {
        stats.unchanged++;
        continue;
      }
      
      console.log(`  ${recordId}: ${currentStatus || 'null'} → ${newStatus}`);
      
      const success = await updateRecordEngagementStatus(objectType, recordId, newStatus);
      
      if (success) {
        stats.updated++;
        updatesSinceLastPause++;
        
        if (updatesSinceLastPause >= BATCH_SIZE) {
          await sleep(RATE_LIMIT_DELAY_MS);
          updatesSinceLastPause = 0;
        }
      } else {
        stats.failed++;
      }
      
    } catch (error) {
      console.error(`  Error processing record ${recordId}:`, error.message);
      stats.failed++;
    }
  }
  
  return stats;
}

// Main function
async function main() {
  const startTime = Date.now();
  
  console.log('='.repeat(60));
  console.log('Attio Engagement Status Updater');
  console.log('='.repeat(60));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Dry run mode: ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Rate limit delay: ${RATE_LIMIT_DELAY_MS}ms`);
  console.log('='.repeat(60));
  console.log();
  
  try {
    console.log('Processing PEOPLE records...');
    console.log('-'.repeat(60));
    
    const peopleRecords = await fetchRecords('people');
    const peopleStats = await processRecords(peopleRecords, 'people');
    
    console.log();
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total people processed: ${peopleRecords.length}`);
    console.log(`  Skipped (Prospecting): ${peopleStats.skipped}`);
    console.log(`  Updated: ${peopleStats.updated}`);
    console.log(`  Unchanged: ${peopleStats.unchanged}`);
    console.log(`  Failed: ${peopleStats.failed}`);
    console.log();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`End time: ${new Date().toISOString()}`);
    console.log(`Total duration: ${duration} seconds`);
    console.log('='.repeat(60));
    
    if (peopleStats.failed > 0) {
      console.error('\nWARNING: Some records failed to update. Review logs above.');
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();