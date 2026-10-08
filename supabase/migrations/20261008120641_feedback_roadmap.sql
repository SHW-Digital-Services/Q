-- Raw suggestions are private. Public roadmap text is a separately reviewed
-- snapshot: saving edits never changes a published item until Publish is chosen.
create table public.feedback_roadmap (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  summary text not null check (char_length(btrim(summary)) between 10 and 3000),
  status text not null default 'under_review' check (status in ('under_review','planned','in_progress','available')),
  revision bigint not null default 1 check (revision > 0),
  published boolean not null default false,
  published_title text,
  published_summary text,
  published_status text check (published_status in ('under_review','planned','in_progress','available')),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not published or (published_title is not null and published_summary is not null and published_status is not null and published_at is not null)),
  check (archived_at is null or not published)
);
create index feedback_roadmap_public_idx on public.feedback_roadmap(published_at desc,id) where published and archived_at is null;
create index feedback_roadmap_staff_idx on public.feedback_roadmap(updated_at desc,id);
create table public.feedback_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  details text not null check (char_length(btrim(details)) between 10 and 5000),
  review_state text not null default 'new' check (review_state in ('new','reviewed')),
  roadmap_id uuid references public.feedback_roadmap(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_suggestions_owner_idx on public.feedback_suggestions(user_id,created_at desc,id);
create index feedback_suggestions_review_idx on public.feedback_suggestions(review_state,created_at desc,id) where archived_at is null;
create index feedback_suggestions_roadmap_idx on public.feedback_suggestions(roadmap_id);
create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.feedback_suggestions(id) on delete cascade,
  roadmap_id uuid references public.feedback_roadmap(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted','saved','published','unpublished','archived','restored','grouped','reviewed')),
  revision bigint not null,
  created_at timestamptz not null default now(),
  check (suggestion_id is not null or roadmap_id is not null)
);
create index feedback_events_suggestion_idx on public.feedback_events(suggestion_id,created_at,id);
create index feedback_events_roadmap_idx on public.feedback_events(roadmap_id,created_at,id);
alter table public.feedback_roadmap enable row level security;
alter table public.feedback_roadmap force row level security;
alter table public.feedback_suggestions enable row level security;
alter table public.feedback_suggestions force row level security;
alter table public.feedback_events enable row level security;
alter table public.feedback_events force row level security;
revoke all on public.feedback_roadmap,public.feedback_suggestions,public.feedback_events from public,anon,authenticated;
grant all on public.feedback_roadmap,public.feedback_suggestions,public.feedback_events to service_role;

create function public.submit_feedback(p_id uuid,p_user_id uuid,p_title text,p_details text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare suggestion public.feedback_suggestions;
begin
  -- Serialise the per-account quota and retry check, including concurrent submits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,13));
  select * into suggestion from public.feedback_suggestions where id=p_id;
  if suggestion.id is not null then
    if suggestion.user_id is distinct from p_user_id or suggestion.title <> p_title or suggestion.details <> p_details then raise exception 'FEEDBACK_CONFLICT'; end if;
    return jsonb_build_object('id',suggestion.id);
  end if;
  if p_user_id is null then raise exception 'FEEDBACK_INVALID'; end if;
  if exists(select 1 from public.feedback_suggestions where user_id=p_user_id and created_at>now()-interval '5 minutes') then raise exception 'FEEDBACK_RATE_LIMIT'; end if;
  insert into public.feedback_suggestions(id,user_id,title,details) values(p_id,p_user_id,p_title,p_details) returning * into suggestion;
  insert into public.feedback_events(suggestion_id,actor_id,action,revision) values(p_id,p_user_id,'submitted',1);
  return jsonb_build_object('id',suggestion.id);
end $$;

create function public.change_feedback_roadmap(p_id uuid,p_actor_id uuid,p_action text,p_expected_revision bigint,
  p_title text default null,p_summary text default null,p_status text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item public.feedback_roadmap; event_action text;
begin
  if p_action not in ('save','publish','unpublish','archive','restore') or p_action is null then raise exception 'FEEDBACK_INVALID'; end if;
  if p_action='save' and p_expected_revision=0 then
    insert into public.feedback_roadmap(id,title,summary,status,created_by,updated_by)
    values(p_id,p_title,p_summary,p_status,p_actor_id,p_actor_id)
    on conflict(id) do nothing returning * into item;
    if item.id is not null then
      insert into public.feedback_events(roadmap_id,actor_id,action,revision) values(p_id,p_actor_id,'saved',1);
      return to_jsonb(item);
    end if;
  end if;
  select * into item from public.feedback_roadmap where id=p_id for update;
  if item.id is null then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  if p_expected_revision=0 and p_action='save' and item.revision=1 and item.created_by=p_actor_id and item.title=p_title and item.summary=p_summary and item.status=p_status then return to_jsonb(item); end if;
  if p_expected_revision is null or item.revision<>p_expected_revision then raise exception 'FEEDBACK_STALE'; end if;
  if item.archived_at is not null and p_action not in ('restore','unpublish') then raise exception 'FEEDBACK_ARCHIVED'; end if;
  if p_action='save' then
    update public.feedback_roadmap set title=p_title,summary=p_summary,status=p_status where id=p_id;
    event_action:='saved';
  elsif p_action='publish' then
    update public.feedback_roadmap set published=true,published_title=title,published_summary=summary,published_status=status,published_at=now() where id=p_id;
    event_action:='published';
  elsif p_action='unpublish' then
    update public.feedback_roadmap set published=false where id=p_id;
    event_action:='unpublished';
  elsif p_action='archive' then
    update public.feedback_roadmap set published=false,archived_at=now() where id=p_id;
    event_action:='archived';
  else
    update public.feedback_roadmap set archived_at=null where id=p_id;
    event_action:='restored';
  end if;
  update public.feedback_roadmap set revision=revision+1,updated_at=now(),updated_by=p_actor_id where id=p_id returning * into item;
  insert into public.feedback_events(roadmap_id,actor_id,action,revision) values(p_id,p_actor_id,event_action,item.revision);
  return to_jsonb(item);
end $$;

create function public.review_feedback(p_changes jsonb,p_actor_id uuid,p_action text,p_roadmap_id uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare requested record; suggestion public.feedback_suggestions; total integer:=0;
begin
  if p_action not in ('group','review','archive','restore') or p_action is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 100 then raise exception 'FEEDBACK_INVALID'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_changes))<>jsonb_array_length(p_changes) then raise exception 'FEEDBACK_INVALID'; end if;
  if p_action='group' and p_roadmap_id is not null then
    perform id from public.feedback_roadmap where id=p_roadmap_id and archived_at is null for share;
    if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  end if;
  -- Consistent lock ordering prevents overlapping grouping batches deadlocking.
  for requested in select (value->>'id')::uuid as id,(value->>'revision')::bigint as revision from jsonb_array_elements(p_changes) order by id loop
    select * into suggestion from public.feedback_suggestions where id=requested.id for update;
    if suggestion.id is null then raise exception 'FEEDBACK_NOT_FOUND'; end if;
    if requested.revision is null or requested.revision<>suggestion.revision then raise exception 'FEEDBACK_STALE'; end if;
    if suggestion.archived_at is not null and p_action<>'restore' then raise exception 'FEEDBACK_ARCHIVED'; end if;
    update public.feedback_suggestions set
      roadmap_id=case when p_action='group' then p_roadmap_id else roadmap_id end,
      review_state=case when p_action in ('group','review') then 'reviewed' else review_state end,
      archived_at=case when p_action='archive' then now() when p_action='restore' then null else archived_at end,
      revision=revision+1,updated_at=now()
      where id=requested.id returning * into suggestion;
    insert into public.feedback_events(suggestion_id,roadmap_id,actor_id,action,revision)
    values(requested.id,suggestion.roadmap_id,p_actor_id,case p_action when 'group' then 'grouped' when 'review' then 'reviewed' when 'archive' then 'archived' else 'restored' end,suggestion.revision);
    total:=total+1;
  end loop;
  return total;
end $$;
revoke all on function public.submit_feedback(uuid,uuid,text,text),public.change_feedback_roadmap(uuid,uuid,text,bigint,text,text,text),public.review_feedback(jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_feedback(uuid,uuid,text,text),public.change_feedback_roadmap(uuid,uuid,text,bigint,text,text,text),public.review_feedback(jsonb,uuid,text,uuid) to service_role;

-- Keep the existing purge entry point and all release-one retention behaviour.
alter function public.purge_expired_operational_data() rename to purge_support_operational_data;
create function public.purge_expired_operational_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; affected integer;
begin
  result:=public.purge_support_operational_data();
  delete from public.feedback_suggestions where (review_state='reviewed' or archived_at is not null) and updated_at<now()-interval '365 days';
  get diagnostics affected=row_count;
  return result||jsonb_build_object('feedback_suggestions',affected);
end $$;
revoke all on function public.purge_support_operational_data(),public.purge_expired_operational_data() from public,anon,authenticated;
grant execute on function public.purge_support_operational_data(),public.purge_expired_operational_data() to service_role;
