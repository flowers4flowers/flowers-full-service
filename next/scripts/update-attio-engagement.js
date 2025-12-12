// Load environment variables from .env file for local testing
if (process.env.NODE_ENV !== "production") {
  try {
    require("dotenv").config();
  } catch (e) {
    console.log("dotenv not installed, using environment variables directly");
  }
}

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ENGAGEMENT_STATUS_SLUG =
  process.env.ENGAGEMENT_STATUS_SLUG || "engagement_status";
const LAST_INTERACTION_SLUG =
  process.env.LAST_INTERACTION_SLUG || "last_interaction";
const ENGAGEMENT_STATUS_SCRAPE_SLUG =
  process.env.ENGAGEMENT_STATUS_SCRAPE_SLUG || "engagement_status_scrape";
const ATTIO_BASE_URL = "https://api.attio.com/v2";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "20", 10);
const RATE_LIMIT_DELAY_MS = parseInt(
  process.env.RATE_LIMIT_DELAY_MS || "100",
  10
);
const DRY_RUN = process.env.DRY_RUN === "true";

// Date thresholds in days
const ACTIVE_THRESHOLD_DAYS = 60;
const COLD_THRESHOLD_DAYS = 180;
const SCRAPE_SKIP_DAYS = 3;

// Validate required environment variables
if (!ATTIO_API_KEY) {
  console.error("ERROR: ATTIO_API_KEY environment variable is required");
  process.exit(1);
}

// Helper function to make API requests
async function attioRequest(endpoint, options = {}) {
  const url = `${ATTIO_BASE_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${ATTIO_API_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error.message);
    throw error;
  }
}

// Helper function to pause execution
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch all records of a given type with pagination
async function fetchRecords(objectType) {
  console.log(`Fetching all ${objectType} records...`);
  const allRecords = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    try {
      const response = await attioRequest(
        `/objects/${objectType}/records/query`,
        {
          method: "POST",
          body: JSON.stringify({
            limit,
            offset,
          }),
        }
      );

      const records = response.data || [];
      allRecords.push(...records);

      console.log(
        `  Fetched ${records.length} records (total so far: ${allRecords.length})`
      );

      if (records.length < limit) {
        break;
      }

      offset += limit;
    } catch (error) {
      console.error(
        `Failed to fetch records at offset ${offset}:`,
        error.message
      );
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

    const activeValue = lastInteractionValues.find(
      (v) => v.active_until === null
    );

    if (!activeValue || !activeValue.interacted_at) {
      return null;
    }

    return new Date(activeValue.interacted_at);
  } catch (error) {
    console.error(`Error extracting last interaction date:`, error.message);
    return null;
  }
}

// Extract the last scrape date from a record
function extractLastScrapeDate(record) {
  try {
    const scrapeValues = record.values[ENGAGEMENT_STATUS_SCRAPE_SLUG];

    if (!scrapeValues || scrapeValues.length === 0) {
      return null;
    }

    const activeValue = scrapeValues.find((v) => v.active_until === null);

    if (!activeValue || !activeValue.original_value) {
      return null;
    }

    return new Date(activeValue.original_value);
  } catch (error) {
    console.error(`Error extracting last scrape date:`, error.message);
    return null;
  }
}

// Calculate engagement status based on last interaction date
function calculateEngagementStatus(lastInteractionDate) {
  if (!lastInteractionDate) {
    return "Dormant";
  }

  const now = new Date();
  const daysDifference = Math.floor(
    (now - lastInteractionDate) / (1000 * 60 * 60 * 24)
  );

  if (daysDifference <= ACTIVE_THRESHOLD_DAYS) {
    return "Active";
  } else if (daysDifference <= COLD_THRESHOLD_DAYS) {
    return "Cold";
  } else {
    return "Dormant";
  }
}

// Get current engagement status from a record
function getCurrentEngagementStatus(record) {
  try {
    const engagementStatusValues = record.values[ENGAGEMENT_STATUS_SLUG];

    if (!engagementStatusValues || engagementStatusValues.length === 0) {
      return null;
    }

    const activeValue = engagementStatusValues.find(
      (v) => v.active_until === null
    );

    if (!activeValue) {
      return null;
    }

    // Debug: log the structure to see what we're working with
    console.log(
      "Active value structure:",
      JSON.stringify(activeValue, null, 2)
    );

    // For select fields, the value is in option.title
    if (activeValue.option && activeValue.option.title) {
      return activeValue.option.title;
    }

    return activeValue.value || null;
  } catch (error) {
    console.error(`Error extracting current engagement status:`, error.message);
    return null;
  }
}

// Check if record was recently scraped and hasn't changed
function shouldSkipRecentScrape(
  record,
  lastInteractionDate,
  currentStatus,
  newStatus
) {
  const lastScrapeDate = extractLastScrapeDate(record);

  if (!lastScrapeDate) {
    return false;
  }

  const now = new Date();
  const daysSinceScrape = Math.floor(
    (now - lastScrapeDate) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceScrape > SCRAPE_SKIP_DAYS) {
    return false;
  }

  if (currentStatus !== newStatus) {
    return false;
  }

  return true;
}

// Update a single record's engagement status and scrape date
async function updateRecordEngagementStatus(objectType, recordId, newStatus) {
  if (DRY_RUN) {
    console.log(
      `  [DRY RUN] Would update ${recordId} to ${newStatus} and set scrape date`
    );
    return true;
  }

  try {
    const now = new Date().toISOString().split("T")[0];

    await attioRequest(`/objects/${objectType}/records/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          values: {
            [ENGAGEMENT_STATUS_SLUG]: newStatus,
            [ENGAGEMENT_STATUS_SCRAPE_SLUG]: now,
          },
        },
      }),
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
    skipped_prospecting: 0,
    skipped_recent_scrape: 0,
    updated: 0,
    failed: 0,
    unchanged: 0,
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

      if (currentStatus === "Prospecting") {
        stats.skipped_prospecting++;
        continue;
      }

      const lastInteractionDate = extractLastInteractionDate(record);
      const newStatus = calculateEngagementStatus(lastInteractionDate);

      if (
        shouldSkipRecentScrape(
          record,
          lastInteractionDate,
          currentStatus,
          newStatus
        )
      ) {
        stats.skipped_recent_scrape++;
        continue;
      }

      if (currentStatus === newStatus) {
        stats.unchanged++;
        continue;
      }

      console.log(`  ${recordId}: ${currentStatus || "null"} → ${newStatus}`);

      const success = await updateRecordEngagementStatus(
        objectType,
        recordId,
        newStatus
      );

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

  console.log("=".repeat(60));
  console.log("Attio Engagement Status Updater");
  console.log("=".repeat(60));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Dry run mode: ${DRY_RUN ? "YES" : "NO"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Rate limit delay: ${RATE_LIMIT_DELAY_MS}ms`);
  console.log(`Scrape skip threshold: ${SCRAPE_SKIP_DAYS} days`);
  console.log("=".repeat(60));
  console.log();

  const totalStats = {
    people: {
      skipped_prospecting: 0,
      skipped_recent_scrape: 0,
      updated: 0,
      failed: 0,
      unchanged: 0,
    },
    companies: {
      skipped_prospecting: 0,
      skipped_recent_scrape: 0,
      updated: 0,
      failed: 0,
      unchanged: 0,
    },
  };

  try {
    // Process People
    console.log("Processing PEOPLE records...");
    console.log("-".repeat(60));

    const peopleRecords = await fetchRecords("people");
    totalStats.people = await processRecords(peopleRecords, "people");

    console.log();
    console.log("People Summary:");
    console.log(`  Total: ${peopleRecords.length}`);
    console.log(
      `  Skipped (Prospecting): ${totalStats.people.skipped_prospecting}`
    );
    console.log(
      `  Skipped (Recent scrape): ${totalStats.people.skipped_recent_scrape}`
    );
    console.log(`  Updated: ${totalStats.people.updated}`);
    console.log(`  Unchanged: ${totalStats.people.unchanged}`);
    console.log(`  Failed: ${totalStats.people.failed}`);
    console.log();

    // Process Companies
    console.log("Processing COMPANIES records...");
    console.log("-".repeat(60));

    const companiesRecords = await fetchRecords("companies");
    totalStats.companies = await processRecords(companiesRecords, "companies");

    console.log();
    console.log("Companies Summary:");
    console.log(`  Total: ${companiesRecords.length}`);
    console.log(
      `  Skipped (Prospecting): ${totalStats.companies.skipped_prospecting}`
    );
    console.log(
      `  Skipped (Recent scrape): ${totalStats.companies.skipped_recent_scrape}`
    );
    console.log(`  Updated: ${totalStats.companies.updated}`);
    console.log(`  Unchanged: ${totalStats.companies.unchanged}`);
    console.log(`  Failed: ${totalStats.companies.failed}`);
    console.log();

    // Final Summary
    console.log("=".repeat(60));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `Total records processed: ${
        peopleRecords.length + companiesRecords.length
      }`
    );
    console.log(`  People: ${peopleRecords.length}`);
    console.log(`  Companies: ${companiesRecords.length}`);
    console.log();
    console.log(
      `Total updated: ${
        totalStats.people.updated + totalStats.companies.updated
      }`
    );
    console.log(
      `Total skipped (Prospecting): ${
        totalStats.people.skipped_prospecting +
        totalStats.companies.skipped_prospecting
      }`
    );
    console.log(
      `Total skipped (Recent scrape): ${
        totalStats.people.skipped_recent_scrape +
        totalStats.companies.skipped_recent_scrape
      }`
    );
    console.log(
      `Total unchanged: ${
        totalStats.people.unchanged + totalStats.companies.unchanged
      }`
    );
    console.log(
      `Total failed: ${totalStats.people.failed + totalStats.companies.failed}`
    );
    console.log();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`End time: ${new Date().toISOString()}`);
    console.log(`Total duration: ${duration} seconds`);
    console.log("=".repeat(60));

    const totalFailed = totalStats.people.failed + totalStats.companies.failed;
    if (totalFailed > 0) {
      console.error(
        "\nWARNING: Some records failed to update. Review logs above."
      );
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error("\nFATAL ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
