/**
 * Google OAuth2 Token Generator
 * 
 * Run this script to get a refresh token for Google Calendar:
 *   npx ts-node scripts/get-google-token.ts
 * 
 * Prerequisites:
 * 1. Go to Google Cloud Console > APIs & Services > Credentials
 * 2. Create OAuth 2.0 Client ID (Desktop app or Web app)
 * 3. Add http://localhost:3000/oauth-callback to Authorized redirect URIs
 * 4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
 */

import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth-callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local');
  console.log('\nAdd these to your .env.local file:');
  console.log('GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
  console.log('GOOGLE_CLIENT_SECRET=your-client-secret');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  prompt: 'consent', // Force to get refresh token
});

console.log('\n🔐 Google Calendar OAuth Setup\n');
console.log('1. Open this URL in your browser:\n');
console.log(`   ${authUrl}\n`);
console.log('2. Sign in and authorize the app');
console.log('3. You will be redirected. Copy the refresh token below.\n');

// Start a temporary server to catch the callback
const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/oauth-callback')) {
    const parsedUrl = url.parse(req.url, true);
    const code = parsedUrl.query.code as string;

    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
              <h1>✅ Success!</h1>
              <p>Add this to your <code>.env.local</code> file:</p>
              <pre style="background: #f0f0f0; padding: 20px; border-radius: 8px; overflow-x: auto;">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
              <p>You can close this window now.</p>
            </body>
          </html>
        `);

        console.log('\n✅ Success! Add this to your .env.local:\n');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        
        server.close();
        process.exit(0);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error getting tokens');
        console.error('Error:', error);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No code provided');
    }
  }
});

server.listen(3000, () => {
  console.log('🌐 Waiting for OAuth callback on http://localhost:3000...\n');
});
