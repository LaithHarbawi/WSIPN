-- =============================================
-- What Should I Play Next? — Supabase Schema
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── Profiles ──
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Game Preference Entries ──
create table public.game_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  igdb_id integer,
  title text not null,
  slug text,
  image_url text,
  sentiment text not null check (sentiment in ('loved', 'liked', 'disliked')),
  play_status text check (play_status in ('completed', 'playing', 'dropped')),
  comment text,
  platform text,
  hours_played integer,
  genres text[],
  released text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.game_entries enable row level security;

create policy "Users can manage own game entries"
  on public.game_entries for all using (auth.uid() = user_id);

create index idx_game_entries_user on public.game_entries(user_id);
create index idx_game_entries_sentiment on public.game_entries(sentiment);

-- ── Recommendation Sessions ──
create table public.recommendation_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  preferences jsonb not null default '{}',
  created_at timestamptz default now() not null
);

alter table public.recommendation_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.recommendation_sessions for all using (auth.uid() = user_id);

create index idx_rec_sessions_user on public.recommendation_sessions(user_id);

-- ── Recommendation Results ──
create table public.recommendation_results (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.recommendation_sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  recommendation_type text not null check (recommendation_type in ('primary', 'wildcard', 'safe_pick', 'surprise')),
  explanation text not null,
  why_matches text not null,
  possible_risk text not null,
  confidence text,
  genres text[],
  platforms text[],
  year text,
  image_url text,
  screenshot_url text,
  metacritic integer,
  sort_order integer default 0,
  created_at timestamptz default now() not null
);

alter table public.recommendation_results enable row level security;

create policy "Users can manage own results"
  on public.recommendation_results for all using (auth.uid() = user_id);

create index idx_rec_results_session on public.recommendation_results(session_id);

-- ── User Feedback on Recommendations ──
create table public.recommendation_feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  result_id uuid references public.recommendation_results(id) on delete cascade not null,
  feedback_type text not null check (feedback_type in ('save', 'not_interested', 'already_played', 'more_like_this')),
  created_at timestamptz default now() not null,
  unique(user_id, result_id)
);

alter table public.recommendation_feedback enable row level security;

create policy "Users can manage own feedback"
  on public.recommendation_feedback for all using (auth.uid() = user_id);

-- ── Saved Games (Play Later) ──
create table public.saved_games (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  image_url text,
  genres text[],
  platforms text[],
  year text,
  source_session_id uuid references public.recommendation_sessions(id) on delete set null,
  notes text,
  created_at timestamptz default now() not null,
  unique(user_id, title)
);

alter table public.saved_games enable row level security;

create policy "Users can manage own saved games"
  on public.saved_games for all using (auth.uid() = user_id);

create index idx_saved_games_user on public.saved_games(user_id);

-- ── Updated-at trigger ──
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_game_entries_updated_at
  before update on public.game_entries
  for each row execute function public.update_updated_at();

-- ── User Data (JSONB store — mirrors localStorage for fast sync) ──
create table public.user_data (
  user_id uuid references auth.users(id) on delete cascade primary key,
  taste_profile jsonb not null default '{"loved":[],"liked":[],"disliked":[]}',
  preferences jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  sessions jsonb not null default '[]',
  steam_profile jsonb,
  onboarding_step integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can read own data"
  on public.user_data for select using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update using (auth.uid() = user_id);

create trigger update_user_data_updated_at
  before update on public.user_data
  for each row execute function public.update_updated_at();

-- ── Group Sessions ──
create table public.group_sessions (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.group_sessions enable row level security;

create policy "Users can manage own group sessions"
  on public.group_sessions for all using (auth.uid() = created_by);

-- ── Group Members ──
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.group_sessions(id) on delete cascade not null,
  name text not null,
  taste_profile jsonb not null default '{}',
  preferences jsonb not null default '{}'
);

alter table public.group_members enable row level security;

create policy "Users can manage group members via session"
  on public.group_members for all
  using (exists (
    select 1 from public.group_sessions gs
    where gs.id = session_id and gs.created_by = auth.uid()
  ));

create index idx_group_members_session on public.group_members(session_id);

-- ── Group Recommendations ──
create table public.group_recommendations (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.group_sessions(id) on delete cascade not null,
  title text not null,
  explanation text not null,
  group_fit text not null,
  possible_conflict text not null,
  confidence text,
  genres text[],
  platforms text[],
  year text,
  image_url text,
  screenshot_url text,
  metacritic integer,
  sort_order integer default 0,
  created_at timestamptz default now() not null
);

alter table public.group_recommendations enable row level security;

create policy "Users can manage group recommendations via session"
  on public.group_recommendations for all
  using (exists (
    select 1 from public.group_sessions gs
    where gs.id = session_id and gs.created_by = auth.uid()
  ));

create index idx_group_recs_session on public.group_recommendations(session_id);
