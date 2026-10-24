-- ============================================================
-- OFES Ver.1.20 / Supabase 初期設定
-- Supabase Dashboard > SQL Editor で、このファイル全体を実行してください。
-- その後、Authentication > Users で管理者ユーザーを1名作成し、
-- 最後にこのファイル末尾の「管理者UID登録」を実行します。
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 管理者UID
create table if not exists public.ofes_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.ofes_admins enable row level security;
revoke all on table public.ofes_admins from anon, authenticated;

create or replace function public.is_ofes_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ofes_admins a where a.user_id = auth.uid()
  );
$$;
revoke all on function public.is_ofes_admin() from public;
grant execute on function public.is_ofes_admin() to authenticated;

-- 2) 公開中のOFES設定（常に id='site' の1行）
create table if not exists public.ofes_site_state (
  id text primary key check (id = 'site'),
  payload jsonb not null,
  event_date date,
  reaction_deadline_at timestamptz,
  reaction_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.ofes_site_state enable row level security;
revoke all on table public.ofes_site_state from anon, authenticated;
grant select on table public.ofes_site_state to anon, authenticated;
grant insert, update on table public.ofes_site_state to authenticated;

drop policy if exists "ofes site public read" on public.ofes_site_state;
create policy "ofes site public read"
on public.ofes_site_state for select
to anon, authenticated
using (id = 'site');

drop policy if exists "ofes site admin insert" on public.ofes_site_state;
create policy "ofes site admin insert"
on public.ofes_site_state for insert
to authenticated
with check (public.is_ofes_admin() and id = 'site');

drop policy if exists "ofes site admin update" on public.ofes_site_state;
create policy "ofes site admin update"
on public.ofes_site_state for update
to authenticated
using (public.is_ofes_admin() and id = 'site')
with check (public.is_ofes_admin() and id = 'site');

-- 3) リアクション受付中かをDB側でも判定
create or replace function public.ofes_reactions_open(p_event_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.event_date = p_event_date
       and s.reaction_deadline_at is not null
       and now() < s.reaction_deadline_at
    from public.ofes_site_state s
    where s.id = 'site'
  ), false);
$$;
revoke all on function public.ofes_reactions_open(date) from public;
grant execute on function public.ofes_reactions_open(date) to authenticated;

-- 4) 来場者リアクション
-- 匿名認証ユーザーも Supabase 上では authenticated ロールになる。
create table if not exists public.ofes_reaction_votes (
  event_date date not null,
  program_id text not null,
  voter_uid uuid not null references auth.users(id) on delete cascade,
  selected text[] not null default '{}',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (event_date, program_id, voter_uid),
  constraint ofes_reaction_selected_valid check (
    cardinality(selected) <= 5
    and selected <@ array['good','aha','amazing','fun','cheer']::text[]
  )
);
create index if not exists ofes_reaction_votes_event_program_idx
  on public.ofes_reaction_votes(event_date, program_id);
alter table public.ofes_reaction_votes enable row level security;
revoke all on table public.ofes_reaction_votes from anon, authenticated;
grant select, insert, update, delete on table public.ofes_reaction_votes to authenticated;

drop policy if exists "reaction read own or admin" on public.ofes_reaction_votes;
create policy "reaction read own or admin"
on public.ofes_reaction_votes for select
to authenticated
using (voter_uid = auth.uid() or public.is_ofes_admin());

drop policy if exists "reaction insert own while open or admin" on public.ofes_reaction_votes;
create policy "reaction insert own while open or admin"
on public.ofes_reaction_votes for insert
to authenticated
with check (
  (voter_uid = auth.uid() and public.ofes_reactions_open(event_date))
  or public.is_ofes_admin()
);

drop policy if exists "reaction update own while open or admin" on public.ofes_reaction_votes;
create policy "reaction update own while open or admin"
on public.ofes_reaction_votes for update
to authenticated
using (
  (voter_uid = auth.uid() and public.ofes_reactions_open(event_date))
  or public.is_ofes_admin()
)
with check (
  (voter_uid = auth.uid() and public.ofes_reactions_open(event_date))
  or public.is_ofes_admin()
);

drop policy if exists "reaction delete own while open or admin" on public.ofes_reaction_votes;
create policy "reaction delete own while open or admin"
on public.ofes_reaction_votes for delete
to authenticated
using (
  (voter_uid = auth.uid() and public.ofes_reactions_open(event_date))
  or public.is_ofes_admin()
);

-- 5) 「Supabaseへ公開」直前の公開データ復元ポイント
create table if not exists public.ofes_publication_backups (
  id uuid primary key default gen_random_uuid(),
  reason text not null default 'pre-publish',
  payload jsonb not null,
  source_year text,
  source_event_date date,
  source_zone_count integer not null default 0,
  source_program_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.ofes_publication_backups enable row level security;
revoke all on table public.ofes_publication_backups from anon, authenticated;
grant select, insert on table public.ofes_publication_backups to authenticated;

drop policy if exists "publication backup admin read" on public.ofes_publication_backups;
create policy "publication backup admin read"
on public.ofes_publication_backups for select
to authenticated using (public.is_ofes_admin());

drop policy if exists "publication backup admin insert" on public.ofes_publication_backups;
create policy "publication backup admin insert"
on public.ofes_publication_backups for insert
to authenticated with check (public.is_ofes_admin());

-- 6) リアクション全クリア前の復元ポイント（1行JSONで保存）
create table if not exists public.ofes_reaction_backups (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  vote_count integer not null default 0,
  program_ids text[] not null default '{}',
  payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists ofes_reaction_backups_event_idx
  on public.ofes_reaction_backups(event_date, created_at desc);
alter table public.ofes_reaction_backups enable row level security;
revoke all on table public.ofes_reaction_backups from anon, authenticated;
grant select, insert on table public.ofes_reaction_backups to authenticated;

drop policy if exists "reaction backup admin read" on public.ofes_reaction_backups;
create policy "reaction backup admin read"
on public.ofes_reaction_backups for select
to authenticated using (public.is_ofes_admin());

drop policy if exists "reaction backup admin insert" on public.ofes_reaction_backups;
create policy "reaction backup admin insert"
on public.ofes_reaction_backups for insert
to authenticated with check (public.is_ofes_admin());

-- 7) 公開データの変更を来場者へ即時反映するため Realtime を有効化
-- すでに追加済みの場合は何もしない。
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ofes_site_state'
  ) then
    execute 'alter publication supabase_realtime add table public.ofes_site_state';
  end if;
end $$;

-- ============================================================
-- 管理者UID登録（別手順）
-- 1. Authentication > Users で管理者ユーザーを作成
-- 2. そのユーザーの UUID をコピー
-- 3. 次の1行の UUID を置き換えて、SQL Editorで実行
--
-- insert into public.ofes_admins(user_id, note)
-- values ('00000000-0000-0000-0000-000000000000', 'OFES管理者')
-- on conflict (user_id) do nothing;
-- ============================================================
