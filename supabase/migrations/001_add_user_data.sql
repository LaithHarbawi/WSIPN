-- Add user_data table for JSONB storage (mirrors localStorage)
create table if not exists public.user_data (
  user_id uuid references auth.users(id) on delete cascade primary key,
  taste_profile jsonb not null default '{"loved":[],"liked":[],"disliked":[]}',
  preferences jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  sessions jsonb not null default '[]',
  saved_games jsonb not null default '[]',
  not_interested jsonb not null default '[]',
  already_played jsonb not null default '[]',
  steam_profile jsonb,
  onboarding_step integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_data
  add column if not exists saved_games jsonb not null default '[]',
  add column if not exists not_interested jsonb not null default '[]',
  add column if not exists already_played jsonb not null default '[]';

alter table public.user_data enable row level security;

create policy "Users can read own data"
  on public.user_data for select using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update using (auth.uid() = user_id);

-- Reuse existing updated_at trigger function
create trigger update_user_data_updated_at
  before update on public.user_data
  for each row execute function public.update_updated_at();

create table if not exists public.user_title_feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  feedback_type text not null check (feedback_type in ('not_interested', 'already_played', 'more_like_this')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, title, feedback_type)
);

alter table public.user_title_feedback enable row level security;

create policy "Users can manage own title feedback"
  on public.user_title_feedback for all using (auth.uid() = user_id);

create index if not exists idx_user_title_feedback_user on public.user_title_feedback(user_id);

create trigger update_user_title_feedback_updated_at
  before update on public.user_title_feedback
  for each row execute function public.update_updated_at();

create table if not exists public.game_entries (
  id uuid primary key,
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

create index if not exists idx_game_entries_user on public.game_entries(user_id);
create index if not exists idx_game_entries_sentiment on public.game_entries(sentiment);

create trigger update_game_entries_updated_at
  before update on public.game_entries
  for each row execute function public.update_updated_at();

create table if not exists public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  preferences jsonb not null default '{}',
  steam_profile jsonb,
  onboarding_step integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can manage own settings"
  on public.user_settings for all using (auth.uid() = user_id);

create trigger update_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.update_updated_at();

create table if not exists public.recommendation_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  preferences jsonb not null default '{}',
  created_at timestamptz default now() not null
);

alter table public.recommendation_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.recommendation_sessions for all using (auth.uid() = user_id);

create index if not exists idx_rec_sessions_user on public.recommendation_sessions(user_id);

create table if not exists public.recommendation_results (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.recommendation_sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  recommendation_type text not null check (recommendation_type in ('primary', 'discovery', 'wildcard', 'safe_pick', 'surprise')),
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

create index if not exists idx_rec_results_session on public.recommendation_results(session_id);

create table if not exists public.rate_limits (
  route_key text not null,
  identifier text not null,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (route_key, identifier)
);

alter table public.rate_limits enable row level security;

create trigger update_rate_limits_updated_at
  before update on public.rate_limits
  for each row execute function public.update_updated_at();

create or replace function public.check_rate_limit(
  p_route_key text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
) as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limits as rl (
    route_key,
    identifier,
    request_count,
    window_started_at
  )
  values (
    p_route_key,
    p_identifier,
    1,
    v_now
  )
  on conflict (route_key, identifier) do update
    set request_count = case
      when rl.window_started_at <= v_window_start then 1
      else rl.request_count + 1
    end,
    window_started_at = case
      when rl.window_started_at <= v_window_start then v_now
      else rl.window_started_at
    end,
    updated_at = v_now;

  return query
  select
    (rl.request_count <= p_limit) as allowed,
    greatest(p_limit - rl.request_count, 0) as remaining,
    (rl.window_started_at + make_interval(secs => p_window_seconds)) as reset_at
  from public.rate_limits rl
  where rl.route_key = p_route_key
    and rl.identifier = p_identifier;
end;
$$ language plpgsql security definer;

revoke all on public.rate_limits from anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
