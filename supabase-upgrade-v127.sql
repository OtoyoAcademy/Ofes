-- ============================================================
-- OFES Ver.1.27 追加SQL
-- 既に Ver.1.20 以降の supabase-setup.sql を実行済みの
-- school-events プロジェクトで、このファイルだけを1回実行してください。
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 大豊学園関係者だけに見せる非公開データ
create table if not exists public.ofes_internal_state (
  year text primary key,
  passcode_hash text not null,
  payload jsonb not null default '{"presenters":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.ofes_internal_state enable row level security;
revoke all on table public.ofes_internal_state from anon, authenticated;
grant select on table public.ofes_internal_state to authenticated;

-- 管理者だけ直接読み取り可能。一般利用者はRPC経由のみ。
drop policy if exists "ofes internal admin read" on public.ofes_internal_state;
create policy "ofes internal admin read"
on public.ofes_internal_state for select
to authenticated
using (public.is_ofes_admin());

create or replace function public.admin_save_ofes_internal(
  p_year text,
  p_passcode text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing_hash text;
begin
  if not public.is_ofes_admin() then
    raise exception 'admin required';
  end if;
  if coalesce(trim(p_year),'') = '' then
    raise exception 'year required';
  end if;

  select passcode_hash into existing_hash
  from public.ofes_internal_state
  where year = p_year;

  if existing_hash is null and coalesce(trim(p_passcode),'') = '' then
    raise exception 'first internal publish requires passcode';
  end if;

  insert into public.ofes_internal_state(year, passcode_hash, payload, updated_at, updated_by)
  values (
    p_year,
    case when coalesce(trim(p_passcode),'') <> ''
      then crypt(p_passcode, gen_salt('bf'))
      else existing_hash end,
    coalesce(p_payload, '{"presenters":{}}'::jsonb),
    now(),
    auth.uid()
  )
  on conflict (year) do update set
    passcode_hash = case when coalesce(trim(p_passcode),'') <> ''
      then crypt(p_passcode, gen_salt('bf'))
      else public.ofes_internal_state.passcode_hash end,
    payload = excluded.payload,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;
revoke all on function public.admin_save_ofes_internal(text,text,jsonb) from public;
grant execute on function public.admin_save_ofes_internal(text,text,jsonb) to authenticated;

create or replace function public.verify_ofes_internal_access(
  p_year text,
  p_passcode text
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when s.passcode_hash = crypt(p_passcode, s.passcode_hash) then s.payload
    else null
  end
  from public.ofes_internal_state s
  where s.year = p_year
  limit 1;
$$;
revoke all on function public.verify_ofes_internal_access(text,text) from public;
grant execute on function public.verify_ofes_internal_access(text,text) to anon, authenticated;

-- 2) 年度ごとの保存データ（管理者専用）
create table if not exists public.ofes_year_archives (
  year text primary key,
  event_date date,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.ofes_year_archives enable row level security;
revoke all on table public.ofes_year_archives from anon, authenticated;
grant select, insert, update, delete on table public.ofes_year_archives to authenticated;

drop policy if exists "ofes year archive admin read" on public.ofes_year_archives;
create policy "ofes year archive admin read"
on public.ofes_year_archives for select
to authenticated using (public.is_ofes_admin());

drop policy if exists "ofes year archive admin insert" on public.ofes_year_archives;
create policy "ofes year archive admin insert"
on public.ofes_year_archives for insert
to authenticated with check (public.is_ofes_admin());

drop policy if exists "ofes year archive admin update" on public.ofes_year_archives;
create policy "ofes year archive admin update"
on public.ofes_year_archives for update
to authenticated using (public.is_ofes_admin()) with check (public.is_ofes_admin());

drop policy if exists "ofes year archive admin delete" on public.ofes_year_archives;
create policy "ofes year archive admin delete"
on public.ofes_year_archives for delete
to authenticated using (public.is_ofes_admin());

-- 3) 公開前バックアップに非公開データも一緒に保持
alter table public.ofes_publication_backups
  add column if not exists internal_payload jsonb;

-- 完了
