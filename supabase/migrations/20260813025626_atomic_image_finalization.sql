create or replace function public.finalize_image_generation(
  p_reservation_id uuid,
  p_page_id uuid,
  p_expected_image_url text,
  p_new_image_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reservation public.ai_generation_reservations%rowtype;
  v_counter public.ai_usage_counters%rowtype;
  v_page public.story_pages%rowtype;
begin
  -- Discover the immutable counter key before taking the shared locks.
  select * into v_reservation
    from public.ai_generation_reservations
   where id = p_reservation_id;
  if not found or v_reservation.resource_kind <> 'image' then
    raise exception 'image reservation not found';
  end if;

  select * into v_counter
    from public.ai_usage_counters
   where user_id = v_reservation.user_id
     and resource_kind = 'image'
     and period_start = v_reservation.counter_period_start
   for update;
  if not found then
    raise exception 'image counter not found';
  end if;

  select * into v_reservation
    from public.ai_generation_reservations
   where id = p_reservation_id
   for update;

  if v_reservation.status = 'completed' then
    return jsonb_build_object(
      'completed', true,
      'idempotency_replayed', true,
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object(
      'completed', false,
      'code', 'reservation_terminal',
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  if v_reservation.expires_at <= v_now then
    update public.ai_generation_reservations
       set status = 'released', released_at = v_now
     where id = v_reservation.id and status = 'reserved';
    update public.ai_usage_counters
       set reserved_count = greatest(0, reserved_count - 1),
           updated_at = v_now
     where user_id = v_counter.user_id
       and resource_kind = v_counter.resource_kind
       and period_start = v_counter.period_start
    returning * into v_counter;
    return jsonb_build_object(
      'completed', false,
      'code', 'reservation_expired',
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  select page.* into v_page
    from public.story_pages page
    join public.stories story on story.id = page.story_id
   where page.id = p_page_id
     and story.user_id = v_reservation.user_id
   for update of page;

  if not found then
    update public.ai_generation_reservations
       set status = 'released', released_at = v_now
     where id = v_reservation.id and status = 'reserved';
    update public.ai_usage_counters
       set reserved_count = greatest(0, reserved_count - 1),
           updated_at = v_now
     where user_id = v_counter.user_id
       and resource_kind = v_counter.resource_kind
       and period_start = v_counter.period_start
    returning * into v_counter;
    return jsonb_build_object(
      'completed', false,
      'code', 'page_not_owned',
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  if p_new_image_url !~ format('^storage://story-illustrations/%s/.+\.webp$', v_reservation.user_id) then
    raise exception 'new image URL must be a user-owned WebP storage URL';
  end if;

  update public.story_pages
     set image_url = p_new_image_url
   where id = v_page.id
     and image_url is not distinct from p_expected_image_url;

  if not found then
    update public.ai_generation_reservations
       set status = 'released', released_at = v_now
     where id = v_reservation.id and status = 'reserved';
    update public.ai_usage_counters
       set reserved_count = greatest(0, reserved_count - 1),
           updated_at = v_now
     where user_id = v_counter.user_id
       and resource_kind = v_counter.resource_kind
       and period_start = v_counter.period_start
    returning * into v_counter;
    return jsonb_build_object(
      'completed', false,
      'code', 'page_changed',
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  update public.ai_generation_reservations
     set status = 'completed', completed_at = v_now
   where id = v_reservation.id and status = 'reserved';
  update public.ai_usage_counters
     set reserved_count = greatest(0, reserved_count - 1),
         used_count = used_count + 1,
         updated_at = v_now
   where user_id = v_counter.user_id
     and resource_kind = v_counter.resource_kind
     and period_start = v_counter.period_start
  returning * into v_counter;

  return jsonb_build_object(
    'completed', true,
    'idempotency_replayed', false,
    'usage', jsonb_build_object(
      'resource_kind', v_counter.resource_kind,
      'limit_count', v_counter.limit_count,
      'used_count', v_counter.used_count,
      'reserved_count', v_counter.reserved_count,
      'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
    )
  );
end;
$$;

revoke all on function public.finalize_image_generation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_image_generation(uuid, uuid, text, text)
  to service_role;
