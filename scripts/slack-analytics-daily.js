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
    console.error("GA4 fetch failed:", error.message);
    throw error;
  }
}

async function sendToSlack(ga4Data) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL_ANALYTICS;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateString = yesterday.toISOString().split("T")[0];

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `GA4 Traffic Report - ${dateString}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Date:* ${dateString} | *Total Sessions:* ${
            ga4Data.totalSessions
          } | *Unique Channels:* ${Object.keys(ga4Data.channels).length}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  if (Object.keys(ga4Data.channels).length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Website Traffic by Channel:*",
      },
    });

    const sortedChannels = Object.entries(ga4Data.channels).sort(
      ([, a], [, b]) => b.sessions - a.sessions
    );

    const channelFields = sortedChannels.map(([channel, data]) => ({
      type: "mrkdwn",
      text: `*${channel}:*\n${data.sessions} sessions | ${data.users} users | ${data.engagedSessions} engaged`,
    }));

    for (let i = 0; i < channelFields.length; i += 10) {
      blocks.push({
        type: "section",
        fields: channelFields.slice(i, i + 10),
      });
    }
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Generated automatically via GitHub Actions",
      },
    ],
  });

  try {
    console.log("Sending GA4 report to Slack...");

    await axios.post(webhookUrl, {
      channel: "#daily-analytics",
      username: "GA4 Traffic Bot",
      icon_emoji: ":chart_with_upwards_trend:",
      blocks: blocks,
    });

    console.log("Successfully sent GA4 report to Slack");
  } catch (error) {
    console.error(
      "Error sending to Slack:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function main() {
  try {
    console.log("Starting GA4 traffic report...");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    console.log("Date:", yesterday.toISOString().split("T")[0]);

    console.log("Fetching GA4 traffic data...");
    const ga4Data = await getGA4TrafficData();

    if (!ga4Data || Object.keys(ga4Data.channels).length === 0) {
      console.log("No GA4 data found for yesterday");

      const webhookUrl = process.env.SLACK_WEBHOOK_URL_ANALYTICS;
      if (webhookUrl) {
        console.log("Sending empty report to Slack...");
        await axios.post(webhookUrl, {
          channel: "#daily-analytics",
          username: "GA4 Traffic Bot",
          icon_emoji: ":chart_with_upwards_trend:",
          text: `GA4 Traffic Report - ${
            yesterday.toISOString().split("T")[0]
          }\n\nNo traffic data recorded yesterday.`,
        });
        console.log("Empty report sent to Slack");
      }

      return;
    }

    console.log("Sending report to Slack...");
    await sendToSlack(ga4Data);

    console.log("GA4 traffic report completed successfully");
    console.log("Report Summary:", {
      totalSessions: ga4Data.totalSessions,
      totalChannels: Object.keys(ga4Data.channels).length,
    });
  } catch (error) {
    console.error("Process failed:", error.message);
    console.error("Stack trace:", error.stack);

    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL_ANALYTICS;
      if (webhookUrl) {
        await axios.post(webhookUrl, {
          channel: "#daily-analytics",
          username: "GA4 Traffic Bot",
          icon_emoji: ":warning:",
          text: `GA4 Traffic Report Failed\n\n**Error:** ${
            error.message
          }\n**Date:** ${new Date().toISOString().split("T")[0]}`,
        });
      }
    } catch (slackError) {
      console.error(
        "Failed to send error notification to Slack:",
        slackError.message
      );
    }

    process.exit(1);
  }
}

main();
