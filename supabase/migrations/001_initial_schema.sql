-- ============================================================
-- GenAI Genesis — Supabase Schema + RLS
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'artist', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Artists
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  bio text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Artworks (original works by artists)
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

-- 4. Generations (AI-generated images)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  image_url text,
  model_used text,
  parameters jsonb default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- 5. Attributions (links generations to influencing artworks)
create table if not exists public.attributions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  similarity_score float not null default 0 check (similarity_score >= 0 and similarity_score <= 1),
  created_at timestamptz not null default now(),
  unique (generation_id, artwork_id)
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_artworks_artist on public.artworks(artist_id);
create index if not exists idx_generations_user on public.generations(user_id);
create index if not exists idx_attributions_generation on public.attributions(generation_id);
create index if not exists idx_attributions_artwork on public.attributions(artwork_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Profiles
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Artists
alter table public.artists enable row level security;

create policy "Artists are viewable by everyone"
  on public.artists for select
  using (true);

create policy "Artists can update own record"
  on public.artists for update
  using (profile_id = auth.uid());

create policy "Authenticated users can create artist records"
  on public.artists for insert
  with check (auth.uid() is not null);

-- Artworks
alter table public.artworks enable row level security;

create policy "Artworks are viewable by everyone"
  on public.artworks for select
  using (true);

create policy "Artists can insert own artworks"
  on public.artworks for insert
  with check (
    exists (
      select 1 from public.artists
      where artists.id = artworks.artist_id
        and artists.profile_id = auth.uid()
    )
  );

create policy "Artists can delete own artworks"
  on public.artworks for delete
  using (
    exists (
      select 1 from public.artists
      where artists.id = artworks.artist_id
        and artists.profile_id = auth.uid()
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

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger artists_updated_at
  before update on public.artists
  for each row execute procedure public.set_updated_at();
