import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
    console.log("🔍 Diagnosing Google Calendar Connection...");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    console.log(`Checked Env Vars:`);
    console.log(`- GOOGLE_CLIENT_ID: ${clientId ? '✅ Found' : '❌ Missing'}`);
    console.log(`- GOOGLE_CLIENT_SECRET: ${clientSecret ? '✅ Found' : '❌ Missing'}`);
    console.log(`- GOOGLE_REFRESH_TOKEN: ${refreshToken ? '✅ Found' : '❌ Missing'}`);
    console.log(`- GOOGLE_CALENDAR_ID: ${calendarId} (Target)`);

    if (!clientId || !clientSecret || !refreshToken) {
        console.error("❌ ABORTING: Missing required credentials.");
        return;
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3000/api/auth/callback/google'
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        console.log("📡 Attempting to fetch events from 'primary' calendar...");
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: nextWeek.toISOString(),
            maxResults: 5,
            singleEvents: true,
        });

        console.log("✅ Success! Connection established.");
        console.log(`📅 Found ${res.data.items?.length || 0} events in the next 7 days.`);
        if (res.data.items && res.data.items.length > 0) {
            console.log("First event:", res.data.items[0].summary);
        }

    } catch (error: any) {
        console.error("❌ Connection Failed!");
        console.error("Error Message:", error.message);
        if (error.response) {
            console.error("API Response:", error.response.data);
        }
    }
}

testConnection();
