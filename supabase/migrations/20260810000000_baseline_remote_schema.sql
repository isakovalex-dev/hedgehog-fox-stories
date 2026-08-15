


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."create_generated_story_with_usage"("p_usage_id" "uuid", "p_title" "text", "p_age_group" "text", "p_mood" "text", "p_lesson" "text", "p_visibility" "text", "p_pages" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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

  if jsonb_array_length(p_pages) > 5 then
    raise exception 'Story cannot contain more than 5 pages';
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
    case when p_age_group = '8-10' then '8-10' else '5-7' end,
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


ALTER FUNCTION "public"."create_generated_story_with_usage"("p_usage_id" "uuid", "p_title" "text", "p_age_group" "text", "p_mood" "text", "p_lesson" "text", "p_visibility" "text", "p_pages" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_generation_access"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.subscriptions%rowtype;
  v_usage public.generation_usage%rowtype;
  v_status text;
  v_limit integer;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now() + interval '30 days';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_subscription
    from public.subscriptions
   where user_id = v_user_id
   order by updated_at desc, created_at desc
   limit 1
   for update;

  if not found then
    insert into public.subscriptions (
      user_id, status, provider, current_period_start, current_period_end
    )
    values (
      v_user_id, 'free', 'system', v_period_start, v_period_end
    )
    returning * into v_subscription;
  elsif v_subscription.status = 'free'
        and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) < now() then
    update public.subscriptions
       set current_period_start = v_period_start,
           current_period_end = v_period_end,
           updated_at = now()
     where id = v_subscription.id
     returning * into v_subscription;
  elsif v_subscription.status in ('active', 'trial')
        and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) < now() then
    update public.subscriptions
       set status = 'expired',
           updated_at = now()
     where id = v_subscription.id
     returning * into v_subscription;
  end if;

  v_status := coalesce(v_subscription.status, 'free');
  v_limit := case
    when v_status = 'active' then 20
    when v_status = 'trial' then 3
    when v_status = 'expired' then 0
    else 1
  end;

  select *
    into v_usage
    from public.generation_usage
   where user_id = v_user_id
     and period_end >= now()
   order by period_start desc, created_at desc
   limit 1
   for update;

  if not found then
    insert into public.generation_usage (
      user_id, period_start, period_end, generations_used, generation_limit
    )
    values (
      v_user_id,
      coalesce(v_subscription.current_period_start, v_period_start),
      coalesce(v_subscription.current_period_end, v_period_end),
      0,
      v_limit
    )
    returning * into v_usage;
  elsif v_usage.generation_limit <> v_limit then
    update public.generation_usage
       set generation_limit = v_limit,
           updated_at = now()
     where id = v_usage.id
     returning * into v_usage;
  end if;

  return jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'usage', to_jsonb(v_usage)
  );
end;
$$;


ALTER FUNCTION "public"."get_generation_access"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."generation_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "generations_used" integer DEFAULT 0 NOT NULL,
    "generation_limit" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."generation_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "age_group" "text",
    "mood" "text",
    "lesson" "text",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "base_likes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "page_number" integer NOT NULL,
    "text" "text" NOT NULL,
    "scene_tag" "text",
    "image_url" "text",
    "image_prompt" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'free'::"text" NOT NULL,
    "provider" "text",
    "provider_subscription_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."generation_usage"
    ADD CONSTRAINT "generation_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_usage"
    ADD CONSTRAINT "generation_usage_user_id_period_start_key" UNIQUE ("user_id", "period_start");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_story_user_unique" UNIQUE ("story_id", "user_id");



ALTER TABLE ONLY "public"."story_pages"
    ADD CONSTRAINT "story_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



CREATE INDEX "story_likes_story_id_idx" ON "public"."story_likes" USING "btree" ("story_id");



CREATE INDEX "story_likes_user_id_idx" ON "public"."story_likes" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."generation_usage"
    ADD CONSTRAINT "generation_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_pages"
    ADD CONSTRAINT "story_pages_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own stories" ON "public"."stories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own story likes" ON "public"."story_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete pages of own stories" ON "public"."story_pages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_pages"."story_id") AND ("stories"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own stories" ON "public"."stories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own story likes" ON "public"."story_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert pages for own stories" ON "public"."story_pages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_pages"."story_id") AND ("stories"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read own generation usage" ON "public"."generation_usage" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own story likes" ON "public"."story_likes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own subscriptions" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own stories" ON "public"."stories" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update pages of own stories" ON "public"."story_pages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_pages"."story_id") AND ("stories"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_pages"."story_id") AND ("stories"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own generation usage" ON "public"."generation_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own stories" ON "public"."stories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view pages of own stories" ON "public"."story_pages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."stories"
  WHERE (("stories"."id" = "story_pages"."story_id") AND ("stories"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."generation_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_generated_story_with_usage"("p_usage_id" "uuid", "p_title" "text", "p_age_group" "text", "p_mood" "text", "p_lesson" "text", "p_visibility" "text", "p_pages" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_generated_story_with_usage"("p_usage_id" "uuid", "p_title" "text", "p_age_group" "text", "p_mood" "text", "p_lesson" "text", "p_visibility" "text", "p_pages" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_generated_story_with_usage"("p_usage_id" "uuid", "p_title" "text", "p_age_group" "text", "p_mood" "text", "p_lesson" "text", "p_visibility" "text", "p_pages" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_generation_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_generation_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_generation_access"() TO "service_role";



GRANT ALL ON TABLE "public"."generation_usage" TO "anon";
GRANT ALL ON TABLE "public"."generation_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_usage" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."story_likes" TO "anon";
GRANT ALL ON TABLE "public"."story_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."story_likes" TO "service_role";



GRANT ALL ON TABLE "public"."story_pages" TO "anon";
GRANT ALL ON TABLE "public"."story_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."story_pages" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
