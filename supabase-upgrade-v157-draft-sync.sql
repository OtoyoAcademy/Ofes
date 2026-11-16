-- OFES Ver.1.57. 既存のOFES用SupabaseプロジェクトのSQL Editorで実行。
-- 公開済みデータと既存の管理者登録はそのまま使います。
begin;

create table if not exists public.ofes_shared_draft (
  id text primary key check (id = 'site'),
  payload jsonb not null,
  revision bigint not null check (revision > 0),
  write_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.ofes_shared_draft enable row level security;
revoke all on table public.ofes_shared_draft from public, anon, authenticated;

create or replace function public.ofes_read_shared_draft()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_ofes_admin() then
    raise exception 'OFES_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  return (select to_jsonb(d) from public.ofes_shared_draft d where d.id = 'site');
end;
$$;

create or replace function public.ofes_save_shared_draft(
  p_payload jsonb, p_expected_revision bigint, p_write_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.ofes_shared_draft%rowtype;
begin
  if not public.is_ofes_admin() then
    raise exception 'OFES_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload->'zones') is distinct from 'array'
     or jsonb_typeof(p_payload->'programs') is distinct from 'array'
     or p_expected_revision is null or p_expected_revision < 0 or p_write_id is null then
    raise exception 'OFES_DRAFT_INVALID' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.ofes_shared_draft(id, payload, revision, write_id)
    values ('site', p_payload - 'test', 1, p_write_id)
    on conflict (id) do nothing
    returning * into saved;
  else
    update public.ofes_shared_draft
    set payload = p_payload - 'test', revision = revision + 1,
        write_id = p_write_id, updated_at = clock_timestamp()
    where id = 'site' and revision = p_expected_revision
    returning * into saved;
  end if;
  if saved.id is null then
    -- 同じ送信を再試行した場合は二重に更新しない。
    select * into saved from public.ofes_shared_draft
    where id = 'site' and write_id = p_write_id and payload = p_payload - 'test';
  end if;
  if saved.id is null then
    raise exception 'OFES_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  return jsonb_build_object('revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;

create or replace function public.ofes_publish_shared_draft(
  p_expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.ofes_shared_draft%rowtype;
  public_payload jsonb;
  private_payload jsonb;
  deadline timestamptz;
begin
  if not public.is_ofes_admin() then
    raise exception 'OFES_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  select * into draft from public.ofes_shared_draft where id = 'site' for update;
  if draft.id is null or draft.revision is distinct from p_expected_revision then
    raise exception 'OFES_DRAFT_CONFLICT' using errcode = '40001';
  end if;

  deadline := (draft.payload->>'reactionDeadline')::timestamp at time zone 'Asia/Tokyo';
  if deadline is null then
    raise exception 'OFES_DRAFT_INVALID' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into public_payload
  from jsonb_each(draft.payload)
  where key in ('schemaVersion','campusCanvasVersion','year','eventDate','slogan',
                'sessions','zones','safetyItems','showSafetyInfo','nextSafetyId','nextIds',
                'programs','reactionDeadline','noticeTitle','noticeMessage','noticeIssuer',
                'stampCompleteImage','stampHints','surveys');
  public_payload := public_payload || jsonb_build_object(
    'programs', coalesce((select jsonb_agg(p.value - 'presenters' order by p.n)
                         from jsonb_array_elements(draft.payload->'programs') with ordinality p(value,n)), '[]'::jsonb),
    'surveys', coalesce((select jsonb_agg(s.value order by s.n)
                        from jsonb_array_elements(coalesce(draft.payload->'surveys','[]'::jsonb)) with ordinality s(value,n)
                        where s.value->>'target' in ('public','both')), '[]'::jsonb)
  );
  private_payload := jsonb_build_object(
    'presenters', coalesce((select jsonb_object_agg(p.value->>'id', p.value->>'presenters')
                            from jsonb_array_elements(draft.payload->'programs') p(value)
                            where p.value->>'id' is not null and btrim(p.value->>'presenters') <> ''), '{}'::jsonb),
    'surveys', coalesce((select jsonb_agg(s.value order by s.n)
                        from jsonb_array_elements(coalesce(draft.payload->'surveys','[]'::jsonb)) with ordinality s(value,n)
                        where s.value->>'target' = 'internal'), '[]'::jsonb)
  );
  perform public.admin_save_ofes_internal(
    draft.payload->>'year', coalesce(draft.payload->>'internalPasscode',''), private_payload
  );
  insert into public.ofes_site_state as site(id, payload, event_date, reaction_deadline_at, updated_at, updated_by)
  values ('site', public_payload, (public_payload->>'eventDate')::date, deadline, clock_timestamp(), auth.uid())
  on conflict (id) do update set
    payload = excluded.payload || case when site.payload ? 'stampResetToken'
      then jsonb_build_object('stampResetToken', site.payload->'stampResetToken') else '{}'::jsonb end,
    event_date = excluded.event_date,
    reaction_deadline_at = excluded.reaction_deadline_at,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.ofes_read_shared_draft() from public, anon, authenticated;
revoke all on function public.ofes_save_shared_draft(jsonb,bigint,uuid) from public, anon, authenticated;
revoke all on function public.ofes_publish_shared_draft(bigint) from public, anon, authenticated;
grant execute on function public.ofes_read_shared_draft() to authenticated;
grant execute on function public.ofes_save_shared_draft(jsonb,bigint,uuid) to authenticated;
grant execute on function public.ofes_publish_shared_draft(bigint) to authenticated;

commit;
