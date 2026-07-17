-- RootedOS production Supabase setup.
-- Run this complete file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  title text not null check (char_length(title) between 3 and 120),
  content text not null check (char_length(content) between 10 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_trails (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_username text not null,
  share_slug text not null unique check (share_slug ~ '^[a-z0-9]{12,32}$'),
  topic text not null check (char_length(topic) between 3 and 160),
  summary text not null check (char_length(summary) between 10 and 1200),
  raw_input_preview text not null default '' check (char_length(raw_input_preview) <= 600),
  source_url text check (source_url is null or char_length(source_url) <= 1200),
  selected_path jsonb not null default '{}'::jsonb,
  trail_map jsonb not null,
  question_seed jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 160),
  category text not null check (category in ('support','feedback','collaboration','privacy','other')),
  subject text not null check (char_length(subject) between 3 and 140),
  message text not null check (char_length(message) between 10 and 5000),
  ip_hash text not null,
  user_agent text not null default '' check (char_length(user_agent) <= 500),
  status text not null default 'new' check (status in ('new','reviewing','resolved','spam')),
  created_at timestamptz not null default now()
);

create index if not exists shared_trails_public_slug_idx on public.shared_trails (share_slug) where is_public = true;
create index if not exists shared_trails_owner_idx on public.shared_trails (owner_id, created_at desc);
create index if not exists contact_submissions_rate_idx on public.contact_submissions (ip_hash, created_at desc);

alter table public.profiles enable row level security;
alter table public.member_posts enable row level security;
alter table public.shared_trails enable row level security;
alter table public.contact_submissions enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable" on public.profiles for select using (true);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public posts are readable" on public.member_posts;
create policy "Public posts are readable" on public.member_posts for select using (true);
drop policy if exists "Signed users create own posts" on public.member_posts;
create policy "Signed users create own posts" on public.member_posts for insert with check (auth.uid() = user_id);
drop policy if exists "Users delete own posts" on public.member_posts;
create policy "Users delete own posts" on public.member_posts for delete using (auth.uid() = user_id);

drop policy if exists "Public shared trails are readable" on public.shared_trails;
create policy "Public shared trails are readable" on public.shared_trails for select using (is_public = true or auth.uid() = owner_id);
drop policy if exists "Users create own shared trails" on public.shared_trails;
create policy "Users create own shared trails" on public.shared_trails for insert with check (auth.uid() = owner_id);
drop policy if exists "Users update own shared trails" on public.shared_trails;
create policy "Users update own shared trails" on public.shared_trails for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users delete own shared trails" on public.shared_trails;
create policy "Users delete own shared trails" on public.shared_trails for delete using (auth.uid() = owner_id);

-- No anon/authenticated policies are created for contact_submissions.
-- Only the server-side service-role endpoint can read or insert contact records.

create or replace function public.set_member_post_username()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.user_id then raise exception 'Authentication required'; end if;
  select username into new.username from public.profiles where id = auth.uid();
  if new.username is null then raise exception 'Set a public username before posting'; end if;
  return new;
end; $$;

drop trigger if exists member_posts_set_username on public.member_posts;
create trigger member_posts_set_username before insert or update on public.member_posts for each row execute function public.set_member_post_username();

create or replace function public.set_shared_trail_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.owner_id then raise exception 'Authentication required'; end if;
  select username into new.owner_username from public.profiles where id = auth.uid();
  if new.owner_username is null then raise exception 'Set a public username before sharing'; end if;
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists shared_trails_set_owner on public.shared_trails;
create trigger shared_trails_set_owner before insert or update on public.shared_trails for each row execute function public.set_shared_trail_owner();

grant usage on schema public to anon, authenticated;
grant select on public.member_posts to anon, authenticated;
grant insert, delete on public.member_posts to authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.shared_trails to anon, authenticated;
grant insert, update, delete on public.shared_trails to authenticated;
revoke all on public.contact_submissions from anon, authenticated;
