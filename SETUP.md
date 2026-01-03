# LifeOS Setup Guide

This guide walks through setting up LifeOS from scratch, including all dependencies and integrations.

## Prerequisites

- **Node.js 18+** - Required for Next.js 16
- **Google Account** - For Calendar API access
- **Supabase Account** - For database (optional, can use mock data)
- **BYU Account** - For Learning Suite integration (optional)

## 1. Project Setup

### Clone and Install

```bash
git clone <your-repo-url>
cd life-os
npm install
```

### Environment Configuration

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
nano .env.local
```

## 2. Supabase Database (Optional)

LifeOS can run with mock data, but for persistence, set up Supabase:

### Create Supabase Project

1. Visit [supabase.com](https://supabase.com)
2. Create new project
3. Wait for setup completion

### Database Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Apply schema
supabase db push
```

### Environment Variables

```bash
# Add to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Google Calendar Integration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable required APIs:
   - Google Calendar API
   - Google OAuth2 API

### Step 2: Create OAuth2 Credentials

1. Navigate to **APIs & Services → Credentials**
2. Click **+ CREATE CREDENTIALS → OAuth 2.0 Client IDs**
3. Configure:
   - **Application type**: Web application
   - **Name**: LifeOS
   - **Authorized redirect URIs**: `http://localhost:3000/oauth-callback`

4. Save **Client ID** and **Client Secret**

### Step 3: Configure Environment

```bash
# Add to .env.local
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 4: Get Refresh Token

```bash
# Run the token generator
npx tsx scripts/get-google-token.ts

# Follow the OAuth flow in your browser
# Copy the refresh token to .env.local
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### Step 5: Create Target Calendar

LifeOS needs a **secondary calendar** to write scheduled events to (never writes to your primary calendar).

1. Open [Google Calendar](https://calendar.google.com)
2. Click **+** next to "Other calendars"
3. Select **Create new calendar**
4. Name it **"LifeOS Schedule"**
5. Click **Create calendar**

### Step 6: Get Calendar ID

1. In Google Calendar, click the **⚙️ Settings** gear
2. Click on **"LifeOS Schedule"** in the left sidebar
3. Scroll down to **"Integrate calendar"**
4. Copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`)

### Step 7: Configure Target Calendar

```bash
# Add to .env.local
GOOGLE_CALENDAR_TARGET_ID=your-calendar-id@group.calendar.google.com

# Optional: Specify which calendar to read from (defaults to 'primary')
GOOGLE_CALENDAR_ID=primary
```

## 4. BYU Learning Suite Integration (Optional)

If you're a BYU student, you can import class schedules:

### Get iCal Feed URL

1. Go to [BYU Learning Suite](https://learningsuite.byu.edu/)
2. Navigate to **Calendar**
3. Click **Export/Subscribe**
4. Copy the **iCal URL**

### Configure Environment

```bash
# Add to .env.local
BYU_ICAL_URL=https://learningsuite.byu.edu/ical/...
```

## 5. Verification

### Test Calendar Read Access

```bash
# Test Google Calendar connection
npx tsx -e "
import { getAllCalendarEvents } from './src/lib/calendars.js';
const events = await getAllCalendarEvents(new Date(), new Date(Date.now() + 7*24*60*60*1000));
console.log('Found', events.length, 'events');
"
```

### Test Full Pipeline

```bash
# Dry run (preview without creating events)
npx tsx scripts/sync-today.ts --dry-run

# Should show:
# - Calendar events fetched
# - Tasks processed (mock if no Supabase)
# - Schedule generated
# - Export preview
```

### Test Dashboard

```bash
npm run dev
# Visit http://localhost:3000/dashboard
```

## 6. Troubleshooting

### Common Issues

#### "GOOGLE_CALENDAR_TARGET_ID not set"
- Ensure you've created a secondary calendar and added its ID to `.env.local`

#### "Invalid credentials"
- Re-run `npx tsx scripts/get-google-token.ts`
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

#### "Calendar API not enabled"
- Go to Google Cloud Console → APIs & Services → Library
- Enable "Google Calendar API"

#### "Redirect URI mismatch"
- In Google Cloud Console, add `http://localhost:3000/oauth-callback` to authorized redirect URIs

#### Supabase connection issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase project is active

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | Yes | OAuth2 refresh token |
| `GOOGLE_CALENDAR_ID` | No | Calendar to read from (default: primary) |
| `GOOGLE_CALENDAR_TARGET_ID` | Yes* | Calendar to write to (*required for live sync) |
| `BYU_ICAL_URL` | No | BYU Learning Suite iCal feed |

## 7. Next Steps

Once setup is complete:

1. **Add Tasks**: Use Supabase dashboard or create API endpoints
2. **Customize Rules**: Modify `src/lib/scheduler.ts` for your needs
3. **Schedule Cron Job**: Set up daily sync (see [Usage Guide](USAGE.md))
4. **Deploy**: Follow deployment instructions in README.md

## Support

- Check the [troubleshooting section](#6-troubleshooting) first
- Review [API documentation](API.md) for function details
- Open issues on GitHub for bugs or feature requests