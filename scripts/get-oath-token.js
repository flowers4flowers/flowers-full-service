import { google } from "googleapis";
import http from "http";
import { URL } from "url";
import open from "open";
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = "848379451942-qjnif2f09brid8uu25ce0gmjk76lv7h5.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

async function getToken() {
  return new Promise((resolve, reject) => {
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf("/oauth2callback") > -1) {
          const qs = new URL(req.url, "http://localhost:3000").searchParams;
          const code = qs.get("code");
          
          res.end("Authentication successful! You can close this window and return to your terminal.");
          server.close();

          const { tokens } = await oauth2Client.getToken(code);
          
          console.log("\n===========================================");
          console.log("SUCCESS! Copy these values to your GitHub Secrets:");
          console.log("===========================================\n");
          console.log("GOOGLE_REFRESH_TOKEN:");
          console.log(tokens.refresh_token);
          console.log("\nGOOGLE_CLIENT_ID:");
          console.log(CLIENT_ID);
          console.log("\nGOOGLE_CLIENT_SECRET:");
          console.log(CLIENT_SECRET);
          console.log("\n===========================================\n");
          
          resolve(tokens);
        }
      } catch (e) {
        reject(e);
      }
    });

    server.listen(3000, () => {
      console.log("\nOpening browser for authentication...");
      console.log("If browser doesn't open, go to this URL:");
      console.log(authorizeUrl);
      open(authorizeUrl);
    });
  });
}

getToken().catch(console.error);