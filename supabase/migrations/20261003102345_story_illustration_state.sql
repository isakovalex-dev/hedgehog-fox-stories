-- Persist the illustration choice with the story and the lifecycle state with
-- each page. Existing stories keep their prior visual behavior by defaulting
-- to enabled illustrations; pages with an existing image are already ready.
alter table public.stories
  add column if not exists illustrations_enabled boolean;

update public.stories
   set illustrations_enabled = true
 where illustrations_enabled is null;

alter table public.stories
  alter column illustrations_enabled set default true,
  alter column illustrations_enabled set not null;

alter table public.story_pages
  add column if not exists image_status text;

update public.story_pages
   set image_status = case
     when nullif(btrim(coalesce(image_url, '')), '') is not null then 'ready'
     else 'pending'
   end
 where image_status is null;

alter table public.story_pages
  alter column image_status set default 'pending',
  alter column image_status set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'story_pages_image_status_check'
       and conrelid = 'public.story_pages'::regclass
  ) then
    alter table public.story_pages
      add constraint story_pages_image_status_check
      check (image_status in ('pending', 'generating', 'ready', 'failed', 'skipped'));
  end if;
end;
$$;

-- The image finalizer still owns the image_url update. This trigger keeps the
-- page lifecycle in sync without duplicating the atomic finalizer's locking
-- and reservation logic.
create or replace function public.sync_story_page_image_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.image_url, '')), '') is not null then
    new.image_status := 'ready';
  elsif old.image_status = 'ready' then
    new.image_status := 'pending';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_story_page_image_status() from public, anon, authenticated;

drop trigger if exists sync_story_page_image_status_before_write on public.story_pages;

create trigger sync_story_page_image_status_before_write
before update of image_url on public.story_pages
for each row execute function public.sync_story_page_image_status();

-- PostgREST does not support overloaded RPC functions. Keep the existing
-- seven-argument finalizer for clients that have not deployed yet and expose
-- this uniquely named, server-only variant for the illustration-state contract.
-- Both the nested finalizer and these updates run in one database transaction.
create or replace function public.create_story_from_reservation_with_illustration_state(
  p_reservation_id uuid,
  p_title text,
  p_age_group text,
  p_mood text,
  p_lesson text,
  p_visibility text,
  p_pages jsonb,
  p_illustrations_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_story_id uuid;
  v_story public.stories%rowtype;
  v_pages jsonb;
begin
  v_result := public.create_story_from_reservation(
    p_reservation_id,
    p_title,
    p_age_group,
    p_mood,
    p_lesson,
    p_visibility,
    p_pages
  );

  if (v_result ? 'created') and coalesce((v_result ->> 'created')::boolean, false) is false then
    return v_result;
  end if;

  v_story_id := (v_result -> 'story' ->> 'id')::uuid;
  if v_story_id is null then
    raise exception 'created story is missing';
  end if;

  update public.stories
     set illustrations_enabled = coalesce(p_illustrations_enabled, true)
   where id = v_story_id
  returning * into v_story;

  update public.story_pages
     set image_status = case
       when coalesce(p_illustrations_enabled, true) is false then 'skipped'
       when nullif(btrim(coalesce(image_url, '')), '') is not null then 'ready'
       else 'pending'
     end
   where story_id = v_story_id;

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.page_number), '[]'::jsonb)
    into v_pages
    from public.story_pages page_row
   where page_row.story_id = v_story_id;

  return jsonb_set(
    jsonb_set(v_result, '{story}', to_jsonb(v_story), true),
    '{pages}',
    v_pages,
    true
  );
end;
$$;

revoke all on function public.create_story_from_reservation_with_illustration_state(uuid, text, text, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.create_story_from_reservation_with_illustration_state(uuid, text, text, text, text, text, jsonb, boolean)
  to service_role;
