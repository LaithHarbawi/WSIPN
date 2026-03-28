-- Add user_data table for JSONB storage (mirrors localStorage)
create table if not exists public.user_data (
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

-- Reuse existing updated_at trigger function
create trigger update_user_data_updated_at
  before update on public.user_data
  for each row execute function public.update_updated_at();
