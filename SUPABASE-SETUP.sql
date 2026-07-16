-- Run once in Supabase SQL Editor.
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

alter table public.profiles enable row level security;
alter table public.member_posts enable row level security;

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

grant usage on schema public to anon, authenticated;
grant select on public.member_posts to anon, authenticated;
grant insert, delete on public.member_posts to authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
