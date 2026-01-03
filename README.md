# LifeOS - Deterministic Auto-Scheduler

> "The first step toward getting somewhere is to decide that you are not going to stay where you are." - J.P. Morgan

LifeOS is a deterministic auto-scheduler designed for busy professionals and students who need to balance family, work, and personal growth. It implements a **family-first protocol** with intelligent task splitting, energy-aware scheduling, and Google Calendar integration.

## 🎯 Core Philosophy

LifeOS follows strict **Life Rules** that prioritize family time and prevent burnout:

- **Family First**: No work after 5:30 PM weekdays, Sundays completely blocked
- **Energy Awareness**: Deep work in mornings, shallow tasks in afternoons
- **Anti-Cramming**: Tasks spread across multiple days to prevent deadline pressure
- **Deterministic**: Same inputs = same schedule (reproducible results)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase Project (with Auth & Database)
- Google Cloud Project (for Calendar OAuth)

### Installation

```bash
# Clone and install
git clone <your-repo>
cd life-os
npm install

# Copy environment template
cp .env.example .env.local
```

### Setup Google Calendar Integration

1. **Google Cloud Console**: 
   - Create project -> Enable "Google Calendar API".
   - Create **OAuth 2.0 Client ID** (Web Application).
   - Add Redirect URI: `http://localhost:3000/auth/callback` (and your production URL).
   - **Important**: Add your email to "Test Users" if in Testing mode.

2. **Supabase Auth**:
   - Enable "Google" provider.
   - Enter Client ID & Secret from Google Cloud.

3. **Environment (.env.local)**:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

### Run the App

```bash
npm run dev
# Visit: http://localhost:3000/dashboard
```

## 📋 Features

### Core Scheduling Engine
- **Task Splitting**: Large tasks automatically split into optimal chunks
- **Energy Profiles**: Deep/shallow/normal work scheduled at appropriate times
- **Family Protection**: Hard blocks around family time
- **Priority System**: High/Medium/Low with deadline awareness

### 🔐 Security & Auth
- **Multi-Tenant**: Google OAuth 2.0 limits access to authorized users only.
- **Row Level Security**: Database policies ensure users only see their own data.
- **2-Way Sync**: Fetches *personal* calendar events using user's specific OAuth token.

### 📊 Dashboard
- **Mobile First**: Responsive "Focus Mode" for on-the-go management.
- **Weekly Review**: Integrated analytics and retrospective tools.
- **Feedback Loop**: Built-in widget to report bugs directly to the developer.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Google OAuth   │───│   Next.js App    │───│   Supabase DB    │
│  (Calendar API) │    │  (App Router)   │    │  (Postgres)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Personal       │    │   Feedback      │    │   RLS Policies  │
│  Events         │    │   Widget        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `scheduler.ts` | Core algorithm | `src/lib/scheduler.ts` |
| `calendars.ts` | Google Calendar API | `src/lib/calendars.ts` |
| `dashboard/page.tsx` | Main Web UI | `src/app/dashboard/page.tsx` |
| `actions/calendar.ts` | Server Actions | `src/app/actions/calendar.ts` |
| `FeedbackWidget` | Beta Feedback | `src/components/FeedbackWidget.tsx` |

## 📚 Documentation

- **[Setup Guide](SETUP.md)** - Detailed environment configuration
- **[API Reference](API.md)** - Function documentation
- **[Architecture](ARCHITECTURE.md)** - System design deep-dive
- **[Usage Guide](USAGE.md)** - How to use LifeOS effectively

## 🧪 Testing

```bash
# Run all tests
npm test

# Run scheduler tests specifically
npm test scheduler

# Watch mode
npm run test:watch
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables for Production

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_CALENDAR_TARGET_ID=...

# Optional
GOOGLE_CALENDAR_ID=primary
BYU_ICAL_URL=...
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Supabase](https://supabase.com/)
- Calendar integration via [Google APIs](https://developers.google.com/calendar/api)
- Inspired by the productivity systems of Cal Newport and James Clear
