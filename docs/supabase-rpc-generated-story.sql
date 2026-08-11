-- RETIRED — DO NOT RUN.
--
-- This legacy browser-callable finalizer is retained solely to explain the
-- previous schema. The versioned security migration
-- supabase/migrations/20260810003928_security_remediation.sql revokes all
-- browser and service-role execution of it and replaces it with the
-- server-only create_story_from_reservation flow.

create or replace function public.create_generated_story_with_usage(
  p_usage_id uuid,
  p_title text,
  p_age_group text,
  p_mood text,
  p_lesson text,
  p_visibility text,
  p_pages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_usage public.generation_usage%rowtype;
  v_story public.stories%rowtype;
  v_pages jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) < 1 then
    raise exception 'Story pages are required';
  end if;

  if jsonb_array_length(p_pages) > 7 then
    raise exception 'Story cannot contain more than 7 pages';
  end if;

  select *
    into v_usage
    from public.generation_usage
    where id = p_usage_id
      and user_id = v_user_id
    for update;

  if not found then
    raise exception 'Generation usage row not found';
  end if;

  if v_usage.generations_used >= v_usage.generation_limit then
    raise exception 'Generation limit exceeded';
  end if;

  insert into public.stories (
    user_id,
    title,
    age_group,
    mood,
    lesson,
    visibility
  )
  values (
    v_user_id,
    left(trim(coalesce(p_title, 'Новая история')), 120),
    case
      when p_age_group in ('5-6', '7-8', '9-10', '5-7', '8-10') then p_age_group
      else '5-6'
    end,
    left(trim(coalesce(p_mood, '')), 80),
    left(trim(coalesce(p_lesson, '')), 160),
    coalesce(nullif(p_visibility, ''), 'private')
  )
  returning * into v_story;

  insert into public.story_pages (
    story_id,
    page_number,
    text,
    scene_tag,
    image_url,
    image_prompt
  )
  select
    v_story.id,
    row_number() over (),
    left(trim(coalesce(page_item->>'text', '')), 700),
    coalesce(nullif(page_item->>'scene_tag', ''), 'forest_day'),
    coalesce(page_item->>'image_url', ''),
    left(coalesce(page_item->>'image_prompt', ''), 240)
  from jsonb_array_elements(p_pages) as page_item;

  update public.generation_usage
     set generations_used = generations_used + 1,
         updated_at = now()
   where id = v_usage.id
     and user_id = v_user_id
   returning * into v_usage;

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.page_number), '[]'::jsonb)
    into v_pages
    from public.story_pages as page_row
    where page_row.story_id = v_story.id;

  return jsonb_build_object(
    'story', to_jsonb(v_story),
    'pages', v_pages,
    'usage', to_jsonb(v_usage)
  );
end;
$$;
