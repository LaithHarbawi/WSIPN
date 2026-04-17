# Supabase Notes

The schema in this folder contains both:

- active tables/functions used by the current app
- more normalized tables that are present for future expansion

## Actively used today

The current authenticated app flow primarily reads and writes:

- `public.user_data`
- `public.game_entries`
- `public.user_settings`
- `public.saved_games`
- `public.recommendation_sessions`
- `public.recommendation_results`
- `public.user_title_feedback`
- `public.check_rate_limit(...)`
- `public.rate_limits`

`user_data` is the live mirror of browser state for:

- current preferences
- current recommendations
- recommendation/session mirrors and save-state compatibility data
- not-interested titles
- already-played titles
- Steam import data
- onboarding step

## Present in schema but not primary runtime storage

These tables exist and may be useful for future normalization, analytics, or admin tooling, but the current app does not primarily persist through them:

- `game_entries`
- `recommendation_feedback`
- `group_sessions`
- `group_members`
- `group_recommendations`

`recommendation_feedback` is still present, but the live app currently uses `user_title_feedback` for durable title-scoped feedback signals across sessions. The normalized results tables now persist recommendation history, but result-linked feedback has not been made the primary runtime path yet.

## Important mismatch that was fixed

`recommendation_results.recommendation_type` now includes `discovery`, which matches the actual recommendation type used by the app.

## Operational note

If you deploy schema changes, make sure the target Supabase project has:

- the extra `user_data` JSONB columns used for authenticated feedback sync
- the durable rate-limit SQL (`rate_limits` table + `check_rate_limit` function)
