# What Should I Play Next? (WSIPN)

Personalized game recommendation engine that understands *why* you play — not just what you play.

## Overview

WSIPN helps users discover video games they'll genuinely enjoy by combining a structured taste profile with intelligent recommendation reasoning. Users build a profile of games they loved, liked, disliked, or didn't finish, add optional comments explaining why, then describe their current mood and preferences. The system analyzes patterns in their taste to deliver personalized, explained recommendations.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **State Management**: Zustand
- **Auth & Database**: Supabase
- **Game Data**: IGDB (via Twitch API)
- **Recommendations**: OpenAI GPT-4o
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

You'll need:

| Variable | Source | Required |
|----------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase Dashboard](https://supabase.com/dashboard) | For auth/DB features |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | For auth/DB features |
| `TWITCH_CLIENT_ID` | [Twitch Developer Console](https://dev.twitch.tv/console/apps) | For game search/autocomplete |
| `TWITCH_CLIENT_SECRET` | Twitch Developer Console → Manage App | For game search/autocomplete |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | For recommendations |

### 3. Set up IGDB access

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
2. Log in with your Twitch account (create one if needed)
3. Click **Register Your Application**
4. Set a name (e.g. "WSIPN"), OAuth redirect to `http://localhost`, category to **Application Integration**
5. Click **Create**, then **Manage** on your new app
6. Copy the **Client ID** → `TWITCH_CLIENT_ID`
7. Click **New Secret**, copy the secret → `TWITCH_CLIENT_SECRET`

### 4. Set up Supabase (optional for guest mode)

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create all tables, RLS policies, and triggers.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

### Guest Mode
- Full functionality without an account
- Data persists in browser localStorage
- Can migrate to an account later

### Taste Profile Builder
- Four categories: Loved, Liked, Disliked, Didn't Finish
- Game search with IGDB autocomplete
- Manual entry for any game
- Optional comments, platform, and hours played per game

### Current Mood Preferences
- Genres, mood/vibe, difficulty, game length
- Player mode, indie/AAA scope, era preference
- Session time commitment, platform
- Broad preferences — the system uses them as guidance, not hard filters

### Recommendations
- 5 primary picks, 2 wildcards, 1 safe pick, 1 surprise
- Each recommendation includes:
  - Personalized explanation
  - "Why this matches you"
  - "Possible risk"
  - Confidence level
  - Cover art and metadata
- Feedback actions: Save, Not Interested, Already Played, More Like This
- Refresh for different recommendations

### Dashboard
- Edit taste profile
- View saved "Play Later" games
- Browse recommendation history
- Re-run previous sessions

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (game search, recommendations)
│   ├── auth/              # Sign in, sign up, callback
│   ├── dashboard/         # User dashboard
│   ├── onboarding/        # Multi-step onboarding wizard
│   └── recommendations/   # Results page
├── components/
│   ├── ui/                # Reusable UI components
│   ├── onboarding/        # Onboarding step components
│   └── recommendations/   # Recommendation cards
├── contexts/              # Zustand store
└── lib/
    ├── supabase/          # Supabase client setup
    ├── game-api.ts        # IGDB API integration
    ├── guest-storage.ts   # localStorage guest mode
    ├── llm.ts             # OpenAI integration
    └── types.ts           # TypeScript types
```

## Data Model

See `supabase/schema.sql` for the full schema including:
- `profiles` — user profiles
- `game_entries` — taste profile games with sentiment + comments
- `recommendation_sessions` — recommendation request history
- `recommendation_results` — individual recommendations
- `recommendation_feedback` — user feedback on recommendations
- `saved_games` — play later list
