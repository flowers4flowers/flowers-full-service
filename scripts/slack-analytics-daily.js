import axios from "axios";
import dotenv from "dotenv";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { google } from "googleapis";

dotenv.config();

const requiredEnvVars = [
  "SLACK_WEBHOOK_URL_ANALYTICS",
  "GA4_PROPERTY_ID",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.error("Please check your .env file or environment variables.");
  process.exit(1);
}

console.log("Environment variables loaded successfully");

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const isRetryable =
        error.code === 4 || // DEADLINE_EXCEEDED
        error.code === 14 || // UNAVAILABLE
        error.code === 8; // RESOURCE_EXHAUSTED

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function getGA4PageData() {
  try {
    console.log("Fetching GA4 page view data...");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const analyticsDataClient = new BetaAnalyticsDataClient({
      authClient: oauth2Client,
      clientConfig: {
        apiEndpoint: "analyticsdata.googleapis.com",
      },
      gaxOptions: {
        timeout: 120000,
      },
    });

    const [response] = await retryWithBackoff(async () => {
      return await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [
          {
            startDate: "yesterday",
            endDate: "yesterday",
          },
        ],
        dimensions: [
          {
            name: "pagePath",
          },
        ],
        metrics: [
          {
            name: "screenPageViews",
          },
          {
            name: "totalUsers",
          },
        ],
      });
    });

    const pageData = {};
    let totalPageViews = 0;

    response.rows?.forEach((row) => {
      const pagePath = row.dimensionValues[0].value;
      const pageViews = parseInt(row.metricValues[0].value);
      const uniqueUsers = parseInt(row.metricValues[1].value);

      pageData[pagePath] = { pageViews, uniqueUsers };
      totalPageViews += pageViews;
    });

    console.log(
      `Found ${totalPageViews} total page views across ${
        Object.keys(pageData).length
      } pages`
    );
    return {
      pages: pageData,
      totalPageViews,
      uniquePages: Object.keys(pageData).length,
    };
  } catch (error) {
    console.error("GA4 page data fetch failed:", error.message);
    return null;
  }
}

async function getGA4EventData() {
  try {
    console.log("Fetching GA4 event data...");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const analyticsDataClient = new BetaAnalyticsDataClient({
      authClient: oauth2Client,
      clientConfig: {
        apiEndpoint: "analyticsdata.googleapis.com",
      },
      gaxOptions: {
        timeout: 120000,
      },
    });

    const [response] = await retryWithBackoff(async () => {
      return await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [
          {
            startDate: "yesterday",
            endDate: "yesterday",
          },
        ],
        dimensions: [
          {
            name: "pagePath",
          },
          {
            name: "eventName",
          },
          {
            name: "customEvent:event_label",
          },
        ],
        metrics: [
          {
            name: "eventCount",
          },
        ],
      });
    });

    const pageEvents = {};
    const projectClicks = {
      "Work List": [],
      "Gallery Image": [],
    };
    let totalEvents = 0;

    response.rows?.forEach((row) => {
      const pagePath = row.dimensionValues[0].value;
      const eventName = row.dimensionValues[1].value;
      const eventLabel = row.dimensionValues[2]?.value || "";
      const eventCount = parseInt(row.metricValues[0].value);

      // Initialize page if not exists
      if (!pageEvents[pagePath]) {
        pageEvents[pagePath] = { events: {}, totalEventCount: 0 };
      }

      // Store event by name
      if (!pageEvents[pagePath].events[eventName]) {
        pageEvents[pagePath].events[eventName] = 0;
      }
      pageEvents[pagePath].events[eventName] += eventCount;
      pageEvents[pagePath].totalEventCount += eventCount;
      totalEvents += eventCount;

      // Extract project clicks
      if (eventName === "link_click" && eventLabel) {
        if (eventLabel.startsWith("Work List:")) {
          const existingClick = projectClicks["Work List"].find(
            (c) => c.label === eventLabel
          );
          if (existingClick) {
            existingClick.count += eventCount;
          } else {
            projectClicks["Work List"].push({
              label: eventLabel,
              count: eventCount,
            });
          }
        } else if (eventLabel.startsWith("Gallery Image:")) {
          const existingClick = projectClicks["Gallery Image"].find(
            (c) => c.label === eventLabel
          );
          if (existingClick) {
            existingClick.count += eventCount;
          } else {
            projectClicks["Gallery Image"].push({
              label: eventLabel,
              count: eventCount,
            });
          }
        }
      }
    });

    console.log(
      `Found ${totalEvents} total events across ${
        Object.keys(pageEvents).length
      } pages`
    );
    return { pageEvents, totalEvents, projectClicks };
  } catch (error) {
    console.error("GA4 event data fetch failed:", error.message);
    return null;
  }
}

async function getGA4TrafficData() {
  try {
    console.log("Fetching GA4 traffic data...");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const analyticsDataClient = new BetaAnalyticsDataClient({
      authClient: oauth2Client,
      clientConfig: {
        apiEndpoint: "analyticsdata.googleapis.com",
      },
      gaxOptions: {
        timeout: 120000, // 2 minutes
      },
    });

    const [response] = await retryWithBackoff(async () => {
      return await analyticsDataClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [
          {
            startDate: "yesterday",
            endDate: "yesterday",
          },
        ],
        dimensions: [
          {
            name: "sessionSource",
          },
          {
            name: "sessionMedium",
          },
        ],
        metrics: [
          {
            name: "sessions",
          },
          {
            name: "engagedSessions",
          },
          {
            name: "totalUsers",
          },
        ],
      });
    });

    const trafficData = {};
    let totalSessions = 0;

    response.rows?.forEach((row) => {
      const source = row.dimensionValues[0].value;
      const medium = row.dimensionValues[1].value;
      const channel = `${source} / ${medium}`;
      const sessions = parseInt(row.metricValues[0].value);
      const engagedSessions = parseInt(row.metricValues[1].value);
      const users = parseInt(row.metricValues[2].value);

      trafficData[channel] = { sessions, engagedSessions, users };
      totalSessions += sessions;
    });

    console.log(
      `Found ${totalSessions} total sessions across ${
        Object.keys(trafficData).length
      } channels`
    );
    return { channels: trafficData, totalSessions };
  } catch (error) {
    console.error("GA4 traffic fetch failed:", error.message);
    return null;
  }
}

function combinePageAndEventData(pageData, eventData) {
  const combinedData = {};
  let totalPageViews = 0;
  let totalEvents = 0;

  // Handle null inputs
  const pages = pageData?.pages || {};
  const events = eventData?.pageEvents || {};

  // Get all unique page paths
  const allPages = [
    ...new Set([...Object.keys(pages), ...Object.keys(events)]),
  ];

  allPages.forEach((pagePath) => {
    const pageViews = pages[pagePath]?.pageViews || 0;
    const uniqueUsers = pages[pagePath]?.uniqueUsers || 0;
    const eventCount = events[pagePath]?.totalEventCount || 0;
    const eventBreakdown = events[pagePath]?.events || {};

    combinedData[pagePath] = {
      pageViews,
      uniqueUsers,
      eventCount,
      events: eventBreakdown,
    };

    totalPageViews += pageViews;
    totalEvents += eventCount;
  });

  return {
    pages: combinedData,
    totalPageViews,
    totalEvents,
    uniquePages: allPages.length,
  };
}

function analyzeProjectClicks(eventData) {
  if (!eventData || !eventData.projectClicks) {
    return {
      workList: [],
      gallery: [],
      totalWorkListClicks: 0,
      totalGalleryClicks: 0,
    };
  }

  const workListClicks = {};
  const galleryClicks = {};

  // Process Work List clicks
  eventData.projectClicks["Work List"]?.forEach((click) => {
    const projectName = click.label.replace("Work List: ", "");
    if (projectName) {
      workListClicks[projectName] =
        (workListClicks[projectName] || 0) + click.count;
    }
  });

  // Process Gallery clicks
  eventData.projectClicks["Gallery Image"]?.forEach((click) => {
    const projectName = click.label.replace("Gallery Image: ", "");
    if (projectName) {
      galleryClicks[projectName] =
        (galleryClicks[projectName] || 0) + click.count;
    }
  });

  // Sort and format
  const sortedWorkList = Object.entries(workListClicks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([projectName, clicks]) => ({ projectName, clicks }));

  const sortedGallery = Object.entries(galleryClicks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([projectName, clicks]) => ({ projectName, clicks }));

  const totalWorkListClicks = Object.values(workListClicks).reduce(
    (sum, count) => sum + count,
    0
  );
  const totalGalleryClicks = Object.values(galleryClicks).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    workList: sortedWorkList,
    gallery: sortedGallery,
    totalWorkListClicks,
    totalGalleryClicks,
  };
}

function createPageDisplayName(pagePath) {
  // Remove query params and hash
  const cleanPath = pagePath.split("?")[0].split("#")[0];

  // Remove trailing slash
  const normalizedPath = cleanPath.endsWith("/")
    ? cleanPath.slice(0, -1)
    : cleanPath;

  // Static page mappings
  const staticPages = {
    "": "Home",
    "/": "Home",
    "/gallery": "Gallery",
    "/work": "Work Listing",
    "/info": "Info",
    "/shop": "Shop",
  };

  if (staticPages[normalizedPath]) {
    return staticPages[normalizedPath];
  }

  // Dynamic project pages
  if (normalizedPath.startsWith("/projects/")) {
    const slug = normalizedPath.replace("/projects/", "");
    const words = slug.split("-");
    const titleCased = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return `${titleCased} Project`;
  }

  // Unknown pages - return the raw path
  return normalizedPath;
}

function formatSlackBlocks(combinedData, projectClicks, trafficData, dateString) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `GA4 Analytics Report - ${dateString}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Date:* ${dateString} | *Total Page Views:* ${combinedData.totalPageViews} | *Unique Pages:* ${combinedData.uniquePages} | *Total Events:* ${combinedData.totalEvents}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  // Page Breakdown Section
  if (Object.keys(combinedData.pages).length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Page Visits & Engagement:*",
      },
    });

    const sortedPages = Object.entries(combinedData.pages).sort(
      ([, a], [, b]) => b.pageViews - a.pageViews
    );

    const pageFields = sortedPages.map(([pagePath, data]) => {
      const displayName = createPageDisplayName(pagePath);
      const userText = data.uniqueUsers > 0 ? ` | ${data.uniqueUsers} users` : "";

      return {
        type: "mrkdwn",
        text: `*${displayName}:*\n${data.pageViews} views${userText} | ${data.eventCount} events`,
      };
    });

    for (let i = 0; i < pageFields.length; i += 10) {
      blocks.push({
        type: "section",
        fields: pageFields.slice(i, i + 10),
      });
    }

    blocks.push({
      type: "divider",
    });
  }

  // Project Clicks Section - Work List
  if (projectClicks.workList.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Most Clicked Projects (Work List):*",
      },
    });

    const workListFields = projectClicks.workList.map((project) => ({
      type: "mrkdwn",
      text: `*${project.projectName}:*\n${project.clicks} clicks`,
    }));

    blocks.push({
      type: "section",
      fields: workListFields,
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Total Work List Clicks: ${projectClicks.totalWorkListClicks}`,
        },
      ],
    });

    blocks.push({
      type: "divider",
    });
  }

  // Project Clicks Section - Gallery
  if (projectClicks.gallery.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Most Clicked Projects (Gallery):*",
      },
    });

    const galleryFields = projectClicks.gallery.map((project) => ({
      type: "mrkdwn",
      text: `*${project.projectName}:*\n${project.clicks} clicks`,
    }));

    blocks.push({
      type: "section",
      fields: galleryFields,
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Total Gallery Clicks: ${projectClicks.totalGalleryClicks}`,
        },
      ],
    });

    blocks.push({
      type: "divider",
    });
  }

  // Traffic Sources Section
  if (trafficData && Object.keys(trafficData.channels).length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Website Traffic by Source:*",
      },
    });

    const sortedChannels = Object.entries(trafficData.channels).sort(
      ([, a], [, b]) => b.sessions - a.sessions
    );

    const channelFields = sortedChannels.map(([channel, data]) => ({
      type: "mrkdwn",
      text: `*${channel}:*\n${data.sessions} sessions | ${data.users} users`,
    }));

    for (let i = 0; i < channelFields.length; i += 10) {
      blocks.push({
        type: "section",
        fields: channelFields.slice(i, i + 10),
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Total Sessions: ${trafficData.totalSessions}`,
        },
      ],
    });

    blocks.push({
      type: "divider",
    });
  }

  // Footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Generated automatically via GitHub Actions",
      },
    ],
  });

  return blocks;
}

async function sendToSlack(blocks) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL_ANALYTICS;

  try {
    console.log("Sending analytics report to Slack...");

    await axios.post(webhookUrl, {
      channel: "#daily-analytics",
      username: "GA4 Analytics Bot",
      icon_emoji: ":chart_with_upwards_trend:",
      blocks: blocks,
    });

    console.log("Successfully sent analytics report to Slack");
  } catch (error) {
    console.error(
      "Error sending to Slack:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function sendErrorNotification(errorMessage, dateString) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL_ANALYTICS;
  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, {
        channel: "#daily-analytics",
        username: "GA4 Analytics Bot",
        icon_emoji: ":warning:",
        text: `GA4 Analytics Report Failed\n\n*Error:* ${errorMessage}\n*Date:* ${dateString}`,
      });
    } catch (error) {
      console.error("Failed to send error notification:", error.message);
    }
  }
}

async function main() {
  try {
    console.log("Starting GA4 analytics report...");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split("T")[0];
    console.log("Date:", dateString);

    // Fetch all GA4 data in parallel
    console.log("Fetching GA4 data from all sources...");
    const [pageData, eventData, trafficData] = await Promise.all([
      getGA4PageData().catch((err) => {
        console.error("Page data fetch failed:", err.message);
        return null;
      }),
      getGA4EventData().catch((err) => {
        console.error("Event data fetch failed:", err.message);
        return null;
      }),
      getGA4TrafficData().catch((err) => {
        console.error("Traffic data fetch failed:", err.message);
        return null;
      }),
    ]);

    // Check if all fetches failed
    if (!pageData && !eventData && !trafficData) {
      console.error("All GA4 data fetches failed");
      await sendErrorNotification("All GA4 data sources failed", dateString);
      process.exit(1);
    }

    // Process data
    console.log("Processing page and event data...");
    const combinedData = combinePageAndEventData(pageData, eventData);

    console.log("Analyzing project clicks...");
    const projectClicks = analyzeProjectClicks(eventData);

    // Format Slack blocks
    console.log("Formatting Slack report...");
    const blocks = formatSlackBlocks(
      combinedData,
      projectClicks,
      trafficData,
      dateString
    );

    // Send to Slack
    console.log("Sending report to Slack...");
    await sendToSlack(blocks);

    // Log success summary
    console.log("GA4 analytics report completed successfully");
    console.log("Report Summary:", {
      date: dateString,
      totalPageViews: combinedData.totalPageViews,
      uniquePages: combinedData.uniquePages,
      totalEvents: combinedData.totalEvents,
      workListClicks: projectClicks.totalWorkListClicks,
      galleryClicks: projectClicks.totalGalleryClicks,
      trafficSessions: trafficData?.totalSessions || 0,
    });
  } catch (error) {
    console.error("Process failed:", error.message);
    console.error("Stack trace:", error.stack);

    // Send error notification to Slack
    try {
      await sendErrorNotification(
        error.message,
        new Date().toISOString().split("T")[0]
      );
    } catch (slackError) {
      console.error(
        "Failed to send error notification:",
        slackError.message
      );
    }

    process.exit(1);
  }
}

main();