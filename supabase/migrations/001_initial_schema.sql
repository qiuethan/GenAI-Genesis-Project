-- ============================================================
-- GenAI Genesis — Supabase Schema + RLS
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- 1. Users (basic user record)
create table if not exists public.users (
  id uuid primary key,
  email text not null,
  created_at timestamptz not null default now()
);

-- 2. Artists (linked to a user)
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  bio text,
  avatar_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Artist AI settings
create table if not exists public.artist_ai_settings (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references public.artists(id) on delete cascade,
  protection_enabled boolean not null default true,
  allow_training boolean not null default false,
  allow_generation boolean not null default true,
  allow_commercial_licensing boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 4. Artworks (original works by artists)
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  image_url text not null,
  protected_image_url text,
  is_public boolean not null default true,
  style_tags text[] default '{}',
  wm_length int,                       -- watermark bit length (needed for extraction)
  created_at timestamptz not null default now()
);

-- 5. Generations (AI-generated images)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  prompt text not null,
  output_url text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  license_type text not null default 'personal',
  total_price float not null default 0,
  artist_pool_amount float not null default 0,
  created_at timestamptz not null default now()
);

-- 6. Generation selected artists (which artists were chosen for a generation)
create table if not exists public.generation_selected_artists (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  weight float not null default 1.0,
  created_at timestamptz not null default now()
);

-- 7. Attributions (links generations to influencing artworks)
create table if not exists public.attributions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  similarity_score float not null default 0
    check (similarity_score >= 0 and similarity_score <= 1),
  created_at timestamptz not null default now(),
  unique (generation_id, artwork_id)
);

-- 8. Artist earnings
create table if not exists public.artist_earnings (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  amount float not null default 0,
  source_type text not null,           -- 'generation' or 'license'
  source_id uuid not null,             -- references the generation or license
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_artists_user on public.artists(user_id);
create index if not exists idx_artworks_artist on public.artworks(artist_id);
create index if not exists idx_generations_user on public.generations(user_id);
create index if not exists idx_gen_selected_artists_gen on public.generation_selected_artists(generation_id);
create index if not exists idx_attributions_generation on public.attributions(generation_id);
create index if not exists idx_attributions_artwork on public.attributions(artwork_id);
create index if not exists idx_earnings_artist on public.artist_earnings(artist_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Users
alter table public.users enable row level security;

create policy "Users are viewable by everyone"
  on public.users for select using (true);

create policy "Users can insert own record"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own record"
  on public.users for update
  using (auth.uid() = id);

-- Artists
alter table public.artists enable row level security;

create policy "Artists are viewable by everyone"
  on public.artists for select using (true);

create policy "Artists can update own record"
  on public.artists for update
  using (user_id = auth.uid());

create policy "Authenticated users can create artist records"
  on public.artists for insert
  with check (auth.uid() is not null);

-- Artist AI Settings
alter table public.artist_ai_settings enable row level security;

create policy "AI settings are viewable by everyone"
  on public.artist_ai_settings for select using (true);

create policy "Artists can manage own AI settings"
  on public.artist_ai_settings for insert
  with check (
    exists (
      select 1 from public.artists
      where artists.id = artist_ai_settings.artist_id
        and artists.user_id = auth.uid()
    )
  );

create policy "Artists can update own AI settings"
  on public.artist_ai_settings for update
  using (
    exists (
      select 1 from public.artists
      where artists.id = artist_ai_settings.artist_id
        and artists.user_id = auth.uid()
    )
  );

-- Artworks
alter table public.artworks enable row level security;

create policy "Artworks are viewable by everyone"
  on public.artworks for select using (true);

create policy "Artists can insert own artworks"
  on public.artworks for insert
  with check (
    exists (
      select 1 from public.artists
      where artists.id = artworks.artist_id
        and artists.user_id = auth.uid()
    )
  );

create policy "Artists can delete own artworks"
  on public.artworks for delete
  using (
    exists (
      select 1 from public.artists
      where artists.id = artworks.artist_id
        and artists.user_id = auth.uid()
    )
  );

-- Generations
alter table public.generations enable row level security;

create policy "Users can view own generations"
  on public.generations for select
  using (user_id = auth.uid());

create policy "Users can insert own generations"
  on public.generations for insert
  with check (user_id = auth.uid());

-- Generation Selected Artists
alter table public.generation_selected_artists enable row level security;

create policy "Selected artists viewable by generation owner"
  on public.generation_selected_artists for select
  using (
    exists (
      select 1 from public.generations
      where generations.id = generation_selected_artists.generation_id
        and generations.user_id = auth.uid()
    )
  );

create policy "System can insert selected artists"
  on public.generation_selected_artists for insert
  with check (auth.uid() is not null);

-- Attributions
alter table public.attributions enable row level security;

create policy "Attributions viewable by generation owner"
  on public.attributions for select
  using (
    exists (
      select 1 from public.generations
      where generations.id = attributions.generation_id
        and generations.user_id = auth.uid()
    )
  );

create policy "System can insert attributions"
  on public.attributions for insert
  with check (auth.uid() is not null);

-- Artist Earnings
alter table public.artist_earnings enable row level security;

create policy "Artists can view own earnings"
  on public.artist_earnings for select
  using (
    exists (
      select 1 from public.artists
      where artists.id = artist_earnings.artist_id
        and artists.user_id = auth.uid()
    )
  );

create policy "System can insert earnings"
  on public.artist_earnings for insert
  with check (auth.uid() is not null);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artists_updated_at
  before update on public.artists
  for each row execute procedure public.set_updated_at();

create trigger ai_settings_updated_at
  before update on public.artist_ai_settings
  for each row execute procedure public.set_updated_at();
