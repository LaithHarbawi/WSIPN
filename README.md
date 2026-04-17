# What Should I Play Next? (WSIPN)

WSIPN is a Next.js app for game recommendations that tries to understand taste, not just popularity. Users build a taste profile from games they loved, liked, or disliked, add optional notes about why, set their current session preferences, and get AI-generated recommendations with explanations.

## Current product scope

- Solo onboarding and recommendation flow
- Guest mode with browser persistence
- Authenticated mode with Supabase-backed sync
- Steam library import for faster profile setup
- Group recommendation flow for multiple participants
- Dashboard with taste profile editing, saved games, and session history
- Feedback actions:
  `Play Later`, `Not Interested`, `Already Played`, `More Like This`

## Tech stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand for client state
- Supabase for auth and persisted user data
- IGDB/Twitch for game search and image enrichment
- OpenAI as the primary recommendation provider
- Groq as the fallback provider

## Recommendation model

The app currently aims to return a 12-game batch:

- 5 `primary`
- 4 `discovery`
- 2 `wildcard`
- 1 `safe_pick` or `surprise` slot each, depending on the batch

The server normalizes provider output into the supported UI types:

- `primary`
- `discovery`
- `wildcard`
- `safe_pick`
- `surprise`

## Persistence model

Guest users store data in local storage.

Authenticated users currently use a hybrid Supabase model:

- normalized tables for durable taste-profile data via `game_entries`
- normalized table for current preferences and onboarding state via `user_settings`
- normalized tables for durable domain data like `saved_games`
- normalized tables for recommendation history via `recommendation_sessions` and `recommendation_results`
- normalized tables for durable per-title feedback via `user_title_feedback`
- `user_data` as a fast mirror for hydrate/session continuity

The `user_data` mirror still carries:

- current recommendations
- `not interested` titles
- `already played` titles
- Steam profile import data
- onboarding step

The repo still contains additional normalized tables that are not yet the primary runtime path for all features.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values you need.

```bash
cp .env.example .env.local
```

Important variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `STEAM_API_KEY`
- `OPENAI_API_KEY`
- `GROQ_API_KEY`

### 3. Apply the Supabase schema

Run the SQL in [supabase/schema.sql](/C:/Users/rholm/Desktop/WSIPN/supabase/schema.sql) or apply the migration in [supabase/migrations/001_add_user_data.sql](/C:/Users/rholm/Desktop/WSIPN/supabase/migrations/001_add_user_data.sql).

Important: the latest schema includes:

- `user_data` JSONB sync fields for saved/ignored/already-played state
- normalized recommendation history tables used by authenticated session persistence
- a durable `rate_limits` table and `check_rate_limit(...)` function used by the recommendation API

If that SQL is not applied, the app still works, but authenticated feedback sync and durable server-side rate limiting will not be fully active.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful scripts

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

Note: `npx tsc --noEmit` depends on generated `.next/types` in this repo, so run it after a build if it complains about missing `.next/types/*`.

## Main flows

### Solo flow

1. Build a taste profile from `Loved`, `Liked`, and `Disliked`
2. Set current mood and session preferences
3. Generate recommendations
4. Save, dismiss, mark played, or request `More Like This`
5. Reopen past sessions from the dashboard

### Group flow

1. Add multiple participants
2. Add or import games for each participant
3. Merge group taste and preferences
4. Generate compromise-friendly recommendations

## Project structure

```text
src/
  app/
    api/
    auth/
    dashboard/
    group/
    onboarding/
    recommendations/
  components/
    group/
    onboarding/
    recommendations/
    ui/
  contexts/
  lib/
    supabase/
supabase/
  migrations/
  schema.sql
```

## Current caveats

- `npm run lint` is now working, but it only helps if the team keeps it in the workflow.
- The app now uses a hybrid Supabase model. `saved_games`, `user_title_feedback`, and normalized recommendation history are primary authenticated stores, while `user_data` remains a fast mirror for hydrate and compatibility.
- Recommendation quality depends on external provider output and IGDB verification.
- Steam import requires a public Steam profile.
- The recommendation API now has a durable Supabase-backed limiter, but the matching SQL must exist in the target Supabase project.
