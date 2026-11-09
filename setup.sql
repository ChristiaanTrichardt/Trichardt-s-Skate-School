-- =====================================================================
--  SKATE SKOOL — database setup for Supabase
--  Run this whole file ONCE in your Supabase project:
--  Dashboard → SQL Editor → New query → paste → Run.
--  It is safe to run again later (it won't delete your data).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------
create table if not exists public.teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Skate Skool',
  teacher_name text not null default '',
  home_theme text not null default 'griptape',
  focus_rate int not null default 1,
  focus_cap int not null default 100,
  quiz_cap int not null default 150,
  welcome int not null default 20,
  timezone text not null default 'Australia/Perth'
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  accent text not null,
  b1 text not null,
  b2 text not null,
  pattern text not null default 'none',
  decor text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text not null default '',
  theme_id text not null default 'griptape',
  code text not null unique,
  announcement text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text not null default '',
  theme_id text not null default '',
  hidden boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  kind text not null check (kind in ('file','youtube','link','note')),
  title text not null,
  description text not null default '',
  url text not null default '',
  storage_path text,
  content_type text,
  size_bytes bigint,
  note text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  per int not null default 5 check (per between 0 and 50),
  questions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.shop_items (
  slot text not null,
  id text not null,
  name text not null,
  price int not null check (price >= 0),
  emoji text,
  sort int not null default 0,
  primary key (slot, id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nickname text not null,
  pin_hash text not null,
  pin_fails int not null default 0,
  color text not null default '#FF2E88',
  earned int not null default 0,
  spent int not null default 0,
  equipped jsonb not null default '{"character":"blob"}',
  owned text[] not null default '{"character:blob"}',
  focus_min int not null default 0,
  focus_sessions int not null default 0,
  quizzes_done int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.enrolments (
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (student_id, class_id)
);

create table if not exists public.coin_log (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  amount int not null,
  reason text not null,
  kind text not null default 'other',
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  minutes int not null,
  label text not null default '',
  class_id uuid references public.classes(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  coins int not null default 0
);

create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null,
  total int not null,
  coins int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists coin_log_student_idx on public.coin_log(student_id, created_at desc);
create index if not exists attempts_student_idx on public.quiz_attempts(student_id, created_at desc);
create index if not exists enrol_class_idx on public.enrolments(class_id);

-- ---------------------------------------------------------------------
--  Helper functions
-- ---------------------------------------------------------------------
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_enrolled(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments e
                 join public.students s on s.id = e.student_id
                 where e.class_id = p_class and s.user_id = auth.uid());
$$;

create or replace function public.unit_visible(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select not hidden from public.units where id = p_unit), true);
$$;

-- Start of "today" in the classroom's time zone
create or replace function public.day_start() returns timestamptz
language sql stable security definer set search_path = public as $$
  select (date_trunc('day', now() at time zone tz) at time zone tz)
  from (select coalesce((select timezone from public.settings where id = 1), 'UTC') as tz) t;
$$;

-- ---------------------------------------------------------------------
--  Row level security: who can read and change what
-- ---------------------------------------------------------------------
alter table public.teachers       enable row level security;
alter table public.settings       enable row level security;
alter table public.themes         enable row level security;
alter table public.classes        enable row level security;
alter table public.units          enable row level security;
alter table public.resources      enable row level security;
alter table public.quizzes        enable row level security;
alter table public.shop_items     enable row level security;
alter table public.students       enable row level security;
alter table public.enrolments     enable row level security;
alter table public.coin_log       enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.quiz_attempts  enable row level security;

drop policy if exists "me" on public.teachers;
create policy "me" on public.teachers for select to authenticated using (user_id = auth.uid());

drop policy if exists "read" on public.settings;
create policy "read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "teacher" on public.settings;
create policy "teacher" on public.settings for update to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.themes;
create policy "read" on public.themes for select to anon, authenticated using (true);
drop policy if exists "teacher" on public.themes;
create policy "teacher" on public.themes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.shop_items;
create policy "read" on public.shop_items for select to authenticated using (true);
drop policy if exists "teacher" on public.shop_items;
create policy "teacher" on public.shop_items for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.classes;
create policy "read" on public.classes for select to authenticated using (public.is_teacher() or public.is_enrolled(id));
drop policy if exists "teacher" on public.classes;
create policy "teacher" on public.classes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.units;
create policy "read" on public.units for select to authenticated using (public.is_teacher() or (not hidden and public.is_enrolled(class_id)));
drop policy if exists "teacher" on public.units;
create policy "teacher" on public.units for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.resources;
create policy "read" on public.resources for select to authenticated using (public.is_teacher() or (public.is_enrolled(class_id) and public.unit_visible(unit_id)));
drop policy if exists "teacher" on public.resources;
create policy "teacher" on public.resources for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "read" on public.quizzes;
create policy "read" on public.quizzes for select to authenticated using (public.is_teacher() or (public.is_enrolled(class_id) and (unit_id is null or public.unit_visible(unit_id))));
drop policy if exists "teacher" on public.quizzes;
create policy "teacher" on public.quizzes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Students can only read their own record; all changes go through the functions below
drop policy if exists "read" on public.students;
create policy "read" on public.students for select to authenticated using (public.is_teacher() or user_id = auth.uid());
drop policy if exists "teacher delete" on public.students;
create policy "teacher delete" on public.students for delete to authenticated using (public.is_teacher());

drop policy if exists "read" on public.enrolments;
create policy "read" on public.enrolments for select to authenticated using (public.is_teacher() or student_id = public.my_student_id());
drop policy if exists "teacher delete" on public.enrolments;
create policy "teacher delete" on public.enrolments for delete to authenticated using (public.is_teacher());

drop policy if exists "read" on public.coin_log;
create policy "read" on public.coin_log for select to authenticated using (public.is_teacher() or student_id = public.my_student_id());
drop policy if exists "read" on public.focus_sessions;
create policy "read" on public.focus_sessions for select to authenticated using (public.is_teacher() or student_id = public.my_student_id());
drop policy if exists "read" on public.quiz_attempts;
create policy "read" on public.quiz_attempts for select to authenticated using (public.is_teacher() or student_id = public.my_student_id());

-- Nobody can read PIN codes through the website
revoke all on public.students from anon, authenticated;
grant select (id, nickname, color, earned, spent, equipped, owned, focus_min, focus_sessions, quizzes_done, created_at)
  on public.students to authenticated;
grant delete on public.students to authenticated;

-- ---------------------------------------------------------------------
--  Student actions (these run on the server, so coins can't be faked)
-- ---------------------------------------------------------------------

-- New student: join a class with its code
create or replace function public.join_new(p_code text, p_nickname text, p_pin text, p_color text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_class uuid; v_student uuid; v_welcome int; v_nick text := btrim(p_nickname);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.my_student_id() is not null then raise exception 'already_student'; end if;
  select id into v_class from public.classes where code = upper(btrim(p_code));
  if v_class is null then raise exception 'bad_code'; end if;
  if length(v_nick) < 1 or length(v_nick) > 20 then raise exception 'bad_name'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'bad_pin'; end if;
  if exists (select 1 from public.students s join public.enrolments e on e.student_id = s.id
             where e.class_id = v_class and lower(s.nickname) = lower(v_nick)) then
    raise exception 'name_taken';
  end if;
  select welcome into v_welcome from public.settings where id = 1;
  insert into public.students (user_id, nickname, pin_hash, color, earned)
  values (auth.uid(), v_nick, crypt(p_pin, gen_salt('bf')),
          case when p_color ~ '^#[0-9A-Fa-f]{6}$' then p_color else '#FF2E88' end,
          coalesce(v_welcome, 0))
  returning id into v_student;
  insert into public.enrolments (student_id, class_id) values (v_student, v_class);
  if coalesce(v_welcome, 0) > 0 then
    insert into public.coin_log (student_id, amount, reason, kind) values (v_student, v_welcome, 'Welcome bonus', 'welcome');
  end if;
  return v_student;
end $$;

-- Existing student: join another class
create or replace function public.join_class(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_class uuid; v_me uuid := public.my_student_id(); v_nick text;
begin
  if v_me is null then raise exception 'not_student'; end if;
  select id into v_class from public.classes where code = upper(btrim(p_code));
  if v_class is null then raise exception 'bad_code'; end if;
  select nickname into v_nick from public.students where id = v_me;
  if exists (select 1 from public.students s join public.enrolments e on e.student_id = s.id
             where e.class_id = v_class and lower(s.nickname) = lower(v_nick) and s.id <> v_me) then
    raise exception 'name_taken';
  end if;
  insert into public.enrolments (student_id, class_id) values (v_me, v_class) on conflict do nothing;
  return v_class;
end $$;

-- Log back in on a new device with class code + nickname + PIN
create or replace function public.recover_student(p_code text, p_nickname text, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_student uuid; v_hash text; v_fails int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select s.id, s.pin_hash, s.pin_fails into v_student, v_hash, v_fails
  from public.students s
  join public.enrolments e on e.student_id = s.id
  join public.classes c on c.id = e.class_id
  where c.code = upper(btrim(p_code)) and lower(s.nickname) = lower(btrim(p_nickname))
  limit 1;
  if v_student is null then raise exception 'no_match'; end if;
  if v_fails >= 10 then raise exception 'locked'; end if;
  if crypt(p_pin, v_hash) <> v_hash then
    -- count the failed try (returning instead of raising keeps the count)
    update public.students set pin_fails = pin_fails + 1 where id = v_student;
    return null;
  end if;
  update public.students set user_id = null where user_id = auth.uid() and id <> v_student;
  update public.students set user_id = auth.uid(), pin_fails = 0 where id = v_student;
  return v_student;
end $$;

create or replace function public.start_focus(p_minutes int, p_label text, p_class uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); v_id uuid;
begin
  if v_me is null then raise exception 'not_student'; end if;
  if p_minutes not in (10, 15, 25, 40) then raise exception 'bad_minutes'; end if;
  delete from public.focus_sessions where student_id = v_me and completed_at is null;
  insert into public.focus_sessions (student_id, minutes, label, class_id)
  values (v_me, p_minutes, left(coalesce(p_label, ''), 120),
          case when public.is_enrolled(p_class) then p_class else null end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_focus(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.focus_sessions where id = p_id and student_id = public.my_student_id() and completed_at is null;
$$;

create or replace function public.complete_focus(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); f public.focus_sessions; st public.settings; v_today int; v_coins int;
begin
  select * into f from public.focus_sessions where id = p_id and student_id = v_me and completed_at is null;
  if f.id is null then raise exception 'no_session'; end if;
  if now() < f.started_at + make_interval(mins => f.minutes) - interval '10 seconds' then raise exception 'too_early'; end if;
  select * into st from public.settings where id = 1;
  select coalesce(sum(coins), 0) into v_today from public.focus_sessions
   where student_id = v_me and completed_at >= public.day_start();
  v_coins := greatest(0, least(f.minutes * st.focus_rate, st.focus_cap - v_today));
  update public.focus_sessions set completed_at = now(), coins = v_coins where id = f.id;
  update public.students set earned = earned + v_coins, focus_min = focus_min + f.minutes,
         focus_sessions = focus_sessions + 1 where id = v_me;
  if v_coins > 0 then
    insert into public.coin_log (student_id, amount, reason, kind)
    values (v_me, v_coins, 'Focus session (' || f.minutes || ' min)', 'focus');
  end if;
  return v_coins;
end $$;

create or replace function public.submit_quiz(p_quiz uuid, p_answers int[])
returns json language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); qz public.quizzes; st public.settings;
        v_total int; v_score int := 0; v_coins int := 0; v_today int; v_done boolean; i int; v_note text := '';
begin
  if v_me is null then raise exception 'not_student'; end if;
  select * into qz from public.quizzes where id = p_quiz;
  if qz.id is null or not public.is_enrolled(qz.class_id) then raise exception 'no_quiz'; end if;
  v_total := jsonb_array_length(qz.questions);
  for i in 0 .. v_total - 1 loop
    if p_answers[i + 1] is not null and p_answers[i + 1] = (qz.questions -> i ->> 'answer')::int then
      v_score := v_score + 1;
    end if;
  end loop;
  select * into st from public.settings where id = 1;
  select exists (select 1 from public.quiz_attempts where student_id = v_me and quiz_id = p_quiz
                 and coins > 0 and created_at >= public.day_start()) into v_done;
  if v_done then
    v_note := 'already';
  else
    select coalesce(sum(coins), 0) into v_today from public.quiz_attempts
     where student_id = v_me and created_at >= public.day_start();
    v_coins := v_score * qz.per + case when v_score = v_total and v_total >= 3 then 5 else 0 end;
    if v_coins > st.quiz_cap - v_today then v_note := 'cap'; end if;
    v_coins := greatest(0, least(v_coins, st.quiz_cap - v_today));
  end if;
  insert into public.quiz_attempts (student_id, quiz_id, score, total, coins)
  values (v_me, p_quiz, v_score, v_total, v_coins);
  update public.students set earned = earned + v_coins, quizzes_done = quizzes_done + 1 where id = v_me;
  if v_coins > 0 then
    insert into public.coin_log (student_id, amount, reason, kind)
    values (v_me, v_coins, 'Quiz: ' || qz.title || ' (' || v_score || '/' || v_total || ')', 'quiz');
  end if;
  return json_build_object('score', v_score, 'total', v_total, 'coins', v_coins, 'note', v_note);
end $$;

create or replace function public.buy_item(p_slot text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); it public.shop_items; s public.students;
begin
  select * into it from public.shop_items where slot = p_slot and id = p_id;
  if it.id is null then raise exception 'no_item'; end if;
  select * into s from public.students where id = v_me for update;
  if s.id is null then raise exception 'not_student'; end if;
  if (p_slot || ':' || p_id) = any (s.owned) then raise exception 'owned'; end if;
  if s.earned - s.spent < it.price then raise exception 'not_enough'; end if;
  update public.students
     set spent = spent + it.price,
         owned = array_append(owned, p_slot || ':' || p_id),
         equipped = case when p_slot = 'color' then equipped else jsonb_set(equipped, array[p_slot], to_jsonb(p_id)) end
   where id = v_me;
  insert into public.coin_log (student_id, amount, reason, kind) values (v_me, -it.price, 'Bought ' || it.name, 'shop');
end $$;

create or replace function public.equip(p_slot text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); s public.students; v_price int;
begin
  select * into s from public.students where id = v_me;
  if s.id is null then raise exception 'not_student'; end if;
  if p_slot = 'color' then
    if p_id !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'bad_color'; end if;
    update public.students set color = p_id where id = v_me;
    return;
  end if;
  if p_id is null or p_id = '' then
    if p_slot = 'character' then raise exception 'need_character'; end if;
    update public.students set equipped = equipped - p_slot where id = v_me;
    return;
  end if;
  select price into v_price from public.shop_items where slot = p_slot and id = p_id;
  if v_price is null then raise exception 'no_item'; end if;
  if v_price > 0 and not ((p_slot || ':' || p_id) = any (s.owned)) then raise exception 'not_owned'; end if;
  update public.students set equipped = jsonb_set(equipped, array[p_slot], to_jsonb(p_id)) where id = v_me;
end $$;

create or replace function public.set_nickname(p_nick text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); v_nick text := btrim(p_nick);
begin
  if v_me is null then raise exception 'not_student'; end if;
  if length(v_nick) < 1 or length(v_nick) > 20 then raise exception 'bad_name'; end if;
  if exists (select 1 from public.students s join public.enrolments e on e.student_id = s.id
             where s.id <> v_me and lower(s.nickname) = lower(v_nick)
               and e.class_id in (select class_id from public.enrolments where student_id = v_me)) then
    raise exception 'name_taken';
  end if;
  update public.students set nickname = v_nick where id = v_me;
end $$;

create or replace function public.class_leaderboard(p_class uuid)
returns table (nickname text, color text, equipped jsonb, lifetime int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then return; end if;
  return query
    select s.nickname, s.color, s.equipped, s.earned, (s.user_id = auth.uid())
    from public.students s join public.enrolments e on e.student_id = s.id
    where e.class_id = p_class
    order by s.earned desc, s.created_at
    limit 10;
end $$;

create or replace function public.class_crew(p_class uuid)
returns table (nickname text, color text, equipped jsonb, lifetime int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then return; end if;
  return query
    select s.nickname, s.color, s.equipped, s.earned, (s.user_id = auth.uid())
    from public.students s join public.enrolments e on e.student_id = s.id
    where e.class_id = p_class
    order by s.earned desc, s.created_at
    limit 60;
end $$;
revoke execute on function public.class_crew(uuid) from public, anon;
grant execute on function public.class_crew(uuid) to authenticated;

-- ---------------------------------------------------------------------
--  Teacher actions
-- ---------------------------------------------------------------------
create or replace function public.award_coins(p_student uuid, p_amount int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'not_teacher'; end if;
  if p_amount = 0 then return; end if;
  update public.students set earned = earned + p_amount where id = p_student;
  insert into public.coin_log (student_id, amount, reason, kind)
  values (p_student, p_amount, coalesce(nullif(btrim(p_reason), ''), 'From your teacher'), 'award');
end $$;

create or replace function public.reset_pin(p_student uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_teacher() then raise exception 'not_teacher'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'bad_pin'; end if;
  update public.students set pin_hash = crypt(p_pin, gen_salt('bf')), pin_fails = 0 where id = p_student;
end $$;

-- Only signed-in users may call these
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
--  Shop catalogue (change prices here or in Table Editor → shop_items)
-- ---------------------------------------------------------------------
insert into public.shop_items (slot, id, name, price, emoji, sort) values
  ('character','blob','Blobby',0,null,1), ('character','cat','Alley Cat',40,null,2),
  ('character','bunny','Riot Rabbit',40,null,3), ('character','bear','Grizz',60,null,4),
  ('character','owl','Night Owl',80,null,5), ('character','ghost','Ghoul',100,null,6),
  ('character','dino','Rex',150,null,7), ('character','robot','Bolt',200,null,8),
  ('hat','backcap','Backwards cap',30,null,1), ('hat','beanie','Beanie',35,null,2),
  ('hat','bandana','Bandana',40,null,3), ('hat','mohawk','Mohawk',60,null,4),
  ('hat','helmet','Skate helmet',70,null,5), ('hat','headphones','Headphones',80,null,6),
  ('hat','grad','Graduation cap',100,null,7), ('hat','spikes','Liberty spikes',140,null,8),
  ('hat','crown','Punk crown',250,null,9),
  ('eyes','shades','Shades',25,null,1), ('eyes','round','Round specs',30,null,2),
  ('eyes','eyepatch','Eyepatch',50,null,3), ('eyes','star','Star shades',90,null,4),
  ('neck','bowtie','Bow tie',20,null,1), ('neck','chain','Chain',35,null,2),
  ('neck','spiked','Spiked collar',60,null,3), ('neck','medal','Gold medal',100,null,4),
  ('pet','rat','Sewer rat',60,'🐀',1), ('pet','kitten','Black cat',80,'🐈‍⬛',2),
  ('pet','puppy','Puppy',80,'🐶',3), ('pet','lizard','Lizard',100,'🦎',4),
  ('pet','bat','Bat',120,'🦇',5), ('pet','fox','Fox',150,'🦊',6),
  ('pet','shark','Shark',200,'🦈',7), ('pet','dragon','Dragon',400,'🐉',8),
  ('plant','cactus','Cactus',20,'🌵',1), ('plant','rose','Rose',30,'🌹',2),
  ('plant','pot','Pot plant',40,'🪴',3), ('plant','sunflower','Sunflower',50,'🌻',4),
  ('plant','mushroom','Mushroom',60,'🍄',5), ('plant','palm','Palm tree',90,'🌴',6),
  ('gear','dice','Dice',15,'🎲',1), ('gear','skateboard','Skateboard',30,'🛹',2),
  ('gear','skates','Roller skates',40,'🛼',3), ('gear','mic','Microphone',50,'🎤',4),
  ('gear','boombox','Boombox',60,'📻',5), ('gear','drum','Drum',70,'🥁',6),
  ('gear','guitar','Electric guitar',90,'🎸',7), ('gear','console','Game console',100,'🎮',8)
on conflict (slot, id) do nothing;

-- ---------------------------------------------------------------------
--  File storage for uploads (PDFs, Word, PowerPoint, images, video)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "teacher uploads" on storage.objects;
create policy "teacher uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and public.is_teacher());
drop policy if exists "teacher updates" on storage.objects;
create policy "teacher updates" on storage.objects for update to authenticated
  using (bucket_id = 'resources' and public.is_teacher());
drop policy if exists "teacher deletes" on storage.objects;
create policy "teacher deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and public.is_teacher());

-- ---------------------------------------------------------------------
--  Study hours, teacher log, to-do lists (also shipped as update-2.sql)
-- ---------------------------------------------------------------------

-- Bowl settings: hours of focus needed, counted this week or all time
alter table public.settings add column if not exists bowl_hours numeric not null default 1;
alter table public.settings add column if not exists bowl_period text not null default 'week';

-- Real names, visible to the teacher (students choose their own skater names)
alter table public.students add column if not exists real_name text not null default '';
grant select (real_name) on public.students to authenticated;

-- Start of this week (Monday) in the classroom's time zone
create or replace function public.week_start() returns timestamptz
language sql stable security definer set search_path = public as $$
  select (date_trunc('week', now() at time zone tz) at time zone tz)
  from (select coalesce((select timezone from public.settings where id = 1), 'UTC') as tz) t;
$$;

-- Everyone in a class, with study minutes (all time and this week)
drop function if exists public.class_crew(uuid);
create function public.class_crew(p_class uuid)
returns table (nickname text, color text, equipped jsonb, lifetime int, focus_min int, week_min int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then return; end if;
  return query
    select s.nickname, s.color, s.equipped, s.earned, s.focus_min,
           coalesce((select sum(f.minutes)::int from public.focus_sessions f
                     where f.student_id = s.id and f.completed_at >= public.week_start()), 0),
           (s.user_id = auth.uid())
    from public.students s join public.enrolments e on e.student_id = s.id
    where e.class_id = p_class
    order by s.focus_min desc, s.created_at
    limit 80;
end $$;

-- Teacher sets a student's real name
create or replace function public.set_real_name(p_student uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'not_teacher'; end if;
  update public.students set real_name = left(btrim(coalesce(p_name, '')), 60) where id = p_student;
end $$;

-- Teacher's log of behaviour, homework and notes (students can't see it)
create table if not exists public.student_log (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null check (category in ('positive','concern','hw_done','hw_missing','note')),
  note text not null default '',
  coins int not null default 0,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists student_log_class_idx on public.student_log(class_id, logged_on desc);
alter table public.student_log enable row level security;
drop policy if exists "teacher" on public.student_log;
create policy "teacher" on public.student_log for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Personal to-do lists (each student and the teacher see only their own)
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  teacher_user uuid references auth.users(id) on delete cascade,
  text text not null check (length(text) between 1 and 200),
  due date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  check ((student_id is null) <> (teacher_user is null))
);
create index if not exists todos_student_idx on public.todos(student_id);
alter table public.todos enable row level security;
drop policy if exists "own" on public.todos;
create policy "own" on public.todos for all to authenticated
  using ((student_id is not null and student_id = public.my_student_id())
      or (teacher_user is not null and teacher_user = auth.uid() and public.is_teacher()))
  with check ((student_id is not null and student_id = public.my_student_id())
      or (teacher_user is not null and teacher_user = auth.uid() and public.is_teacher()));

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
--  Tricks, markbook, achievements, skateparks, fonts (also shipped as update-3.sql)
-- ---------------------------------------------------------------------

-- Fonts for headings (site default, optional per-class override)
alter table public.settings add column if not exists heading_font text not null default 'Rubik Dirt';
alter table public.classes add column if not exists heading_font text not null default '';

-- Which skatepark a class uses, and decorations the teacher has switched off
alter table public.classes add column if not exists park text not null default 'brickyard';
alter table public.classes add column if not exists decor_off text[] not null default '{}';

-- Tricks the teacher has unlocked for each student
alter table public.students add column if not exists tricks text[] not null default '{}';
grant select (tricks) on public.students to authenticated;

-- Store each answer so the markbook can show question-by-question results
alter table public.quiz_attempts add column if not exists answers int[];

-- ---------------------------------------------------------------------
--  Class achievements (edit names/thresholds in Table Editor → achievements)
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  key text primary key,
  name text not null,
  description text not null default '',
  metric text not null check (metric in ('focus_hours','quizzes','perfect','members','riders')),
  threshold numeric not null,
  reward_type text not null check (reward_type in ('park','decor')),
  reward_id text not null,
  sort int not null default 0
);
alter table public.achievements enable row level security;
drop policy if exists "read" on public.achievements;
create policy "read" on public.achievements for select to authenticated using (true);
drop policy if exists "teacher" on public.achievements;
create policy "teacher" on public.achievements for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create table if not exists public.class_unlocks (
  class_id uuid not null references public.classes(id) on delete cascade,
  key text not null references public.achievements(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  by_teacher boolean not null default false,
  primary key (class_id, key)
);
alter table public.class_unlocks enable row level security;
drop policy if exists "read" on public.class_unlocks;
create policy "read" on public.class_unlocks for select to authenticated using (public.is_teacher() or public.is_enrolled(class_id));
drop policy if exists "teacher" on public.class_unlocks;
create policy "teacher" on public.class_unlocks for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

insert into public.achievements (key, name, description, metric, threshold, reward_type, reward_id, sort) values
  ('first_drop',    'First Drop',        'Study 1 hour as a class',               'focus_hours', 1,   'decor', 'bolt',       1),
  ('crew_up',       'Crew Up',           '3 skaters join the class',              'members',     3,   'decor', 'tag_crew',   2),
  ('quiz_kids',     'Quiz Kids',         'Finish 10 quizzes as a class',          'quizzes',     10,  'decor', 'aplus',      3),
  ('warehouse_key', 'Warehouse Key',     'Study 2 hours as a class',              'focus_hours', 2,   'park',  'warehouse',  4),
  ('flawless',      'Flawless x3',       'Get 3 perfect quiz scores',             'perfect',     3,   'decor', 'hundred',    5),
  ('backyard_bash', 'Backyard Bash',     'Study 5 hours as a class',              'focus_hours', 5,   'park',  'backyard',   6),
  ('double_trouble','Double Trouble',    '2 skaters riding the bowl at once',     'riders',      2,   'decor', 'crown',      7),
  ('quiz_shred',    'Quiz Shredders',    'Finish 30 quizzes as a class',          'quizzes',     30,  'decor', 'shred',      8),
  ('beach_day',     'Beach Day',         'Study 10 hours as a class',             'focus_hours', 10,  'park',  'beach',      9),
  ('full_crew',     'Full Crew',         '10 skaters join the class',             'members',     10,  'decor', 'classpiece', 10),
  ('on_fire',       'On Fire',           'Study 15 hours as a class',             'focus_hours', 15,  'decor', 'flames',     11),
  ('rooftop',       'Rooftop Access',    'Study 20 hours as a class',             'focus_hours', 20,  'park',  'rooftop',    12),
  ('big_brains',    'Big Brains',        'Get 10 perfect quiz scores',            'perfect',     10,  'decor', 'brain',      13),
  ('packed_bowl',   'Packed Bowl',       '5 skaters riding the bowl at once',     'riders',      5,   'decor', 'checker',    14),
  ('outback',       'Outback Run',       'Study 35 hours as a class',             'focus_hours', 35,  'park',  'outback',    15),
  ('quiz_machine',  'Quiz Machine',      'Finish 75 quizzes as a class',          'quizzes',     75,  'decor', 'fire',       16),
  ('into_woods',    'Into the Woods',    'Study 50 hours as a class',             'focus_hours', 50,  'park',  'forest',     17),
  ('squad_goals',   'Squad Goals',       '20 skaters join the class',             'members',     20,  'decor', 'horns',      18),
  ('neon_nights',   'Neon Nights',       'Study 75 hours as a class',             'focus_hours', 75,  'park',  'neon',       19),
  ('legends',       'Legends Only',      'Get 25 perfect quiz scores',            'perfect',     25,  'decor', 'legends',    20),
  ('quiz_legends',  'Quiz Legends',      'Finish 150 quizzes as a class',         'quizzes',     150, 'decor', 'board',      21),
  ('moon',          'One Small Kickflip','Study 100 hours as a class',            'focus_hours', 100, 'park',  'moon',       22),
  ('golden_era',    'Golden Era',        '10 skaters riding the bowl at once',    'riders',      10,  'decor', 'gold',       23)
on conflict (key) do nothing;

-- Works out a class's totals and records any newly reached achievements
create or replace function public.class_progress(p_class uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_members int; v_focus numeric; v_quiz int; v_perfect int; v_riders int; v_need numeric; v_period text;
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then raise exception 'no_access'; end if;
  select count(*) into v_members from public.enrolments where class_id = p_class;
  select coalesce(sum(s.focus_min), 0) / 60.0 into v_focus
    from public.students s join public.enrolments e on e.student_id = s.id where e.class_id = p_class;
  select count(*), count(*) filter (where a.total > 0 and a.score = a.total) into v_quiz, v_perfect
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.class_id = p_class;
  select bowl_hours * 60, bowl_period into v_need, v_period from public.settings where id = 1;
  select count(*) into v_riders from (
    select case when v_period = 'all' then s.focus_min
                else coalesce((select sum(f.minutes) from public.focus_sessions f
                               where f.student_id = s.id and f.completed_at >= public.week_start()), 0) end as m
    from public.students s join public.enrolments e on e.student_id = s.id where e.class_id = p_class) x
  where x.m > 0 and x.m >= v_need;
  insert into public.class_unlocks (class_id, key)
    select p_class, a.key from public.achievements a
    where (case a.metric when 'focus_hours' then v_focus when 'quizzes' then v_quiz when 'perfect' then v_perfect
                         when 'members' then v_members when 'riders' then v_riders end) >= a.threshold
  on conflict do nothing;
  return json_build_object(
    'stats', json_build_object('focus_hours', round(v_focus, 1), 'quizzes', v_quiz, 'perfect', v_perfect, 'members', v_members, 'riders', v_riders),
    'unlocks', coalesce((select json_agg(json_build_object('key', key, 'at', unlocked_at, 'by_teacher', by_teacher))
                         from public.class_unlocks where class_id = p_class), '[]'::json));
end $$;

-- Teacher unlocks tricks for a student
create or replace function public.set_tricks(p_student uuid, p_tricks text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'not_teacher'; end if;
  update public.students
     set tricks = array(select distinct t from unnest(coalesce(p_tricks, '{}')) t
                        where t = any (array['ollie','kickflip','shuvit','treflip','indy','handplant','spin540','backflip']))
   where id = p_student;
end $$;

-- Class crew now includes each skater's tricks
drop function if exists public.class_crew(uuid);
create function public.class_crew(p_class uuid)
returns table (nickname text, color text, equipped jsonb, lifetime int, focus_min int, week_min int, tricks text[], is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then return; end if;
  return query
    select s.nickname, s.color, s.equipped, s.earned, s.focus_min,
           coalesce((select sum(f.minutes)::int from public.focus_sessions f
                     where f.student_id = s.id and f.completed_at >= public.week_start()), 0),
           s.tricks, (s.user_id = auth.uid())
    from public.students s join public.enrolments e on e.student_id = s.id
    where e.class_id = p_class
    order by s.focus_min desc, s.created_at
    limit 80;
end $$;

-- Focus sessions can be any length from 1 to 180 minutes
create or replace function public.start_focus(p_minutes int, p_label text, p_class uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); v_id uuid;
begin
  if v_me is null then raise exception 'not_student'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 180 then raise exception 'bad_minutes'; end if;
  delete from public.focus_sessions where student_id = v_me and completed_at is null;
  insert into public.focus_sessions (student_id, minutes, label, class_id)
  values (v_me, p_minutes, left(coalesce(p_label, ''), 120),
          case when public.is_enrolled(p_class) then p_class else null end)
  returning id into v_id;
  return v_id;
end $$;

-- Quizzes now save each answer for the markbook
create or replace function public.submit_quiz(p_quiz uuid, p_answers int[])
returns json language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_student_id(); qz public.quizzes; st public.settings;
        v_total int; v_score int := 0; v_coins int := 0; v_today int; v_done boolean; i int; v_note text := '';
begin
  if v_me is null then raise exception 'not_student'; end if;
  select * into qz from public.quizzes where id = p_quiz;
  if qz.id is null or not public.is_enrolled(qz.class_id) then raise exception 'no_quiz'; end if;
  v_total := jsonb_array_length(qz.questions);
  for i in 0 .. v_total - 1 loop
    if p_answers[i + 1] is not null and p_answers[i + 1] = (qz.questions -> i ->> 'answer')::int then
      v_score := v_score + 1;
    end if;
  end loop;
  select * into st from public.settings where id = 1;
  select exists (select 1 from public.quiz_attempts where student_id = v_me and quiz_id = p_quiz
                 and coins > 0 and created_at >= public.day_start()) into v_done;
  if v_done then
    v_note := 'already';
  else
    select coalesce(sum(coins), 0) into v_today from public.quiz_attempts
     where student_id = v_me and created_at >= public.day_start();
    v_coins := v_score * qz.per + case when v_score = v_total and v_total >= 3 then 5 else 0 end;
    if v_coins > st.quiz_cap - v_today then v_note := 'cap'; end if;
    v_coins := greatest(0, least(v_coins, st.quiz_cap - v_today));
  end if;
  insert into public.quiz_attempts (student_id, quiz_id, score, total, coins, answers)
  values (v_me, p_quiz, v_score, v_total, v_coins, p_answers[1:v_total]);
  update public.students set earned = earned + v_coins, quizzes_done = quizzes_done + 1 where id = v_me;
  if v_coins > 0 then
    insert into public.coin_log (student_id, amount, reason, kind)
    values (v_me, v_coins, 'Quiz: ' || qz.title || ' (' || v_score || '/' || v_total || ')', 'quiz');
  end if;
  return json_build_object('score', v_score, 'total', v_total, 'coins', v_coins, 'note', v_note);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
--  Whiteboard, surf world (also shipped as update-4.sql)
-- ---------------------------------------------------------------------

-- Which world each class lives in ('skate' or 'surf'), and the world for pages outside a class
alter table public.classes add column if not exists world text not null default 'skate';
alter table public.settings add column if not exists home_world text not null default 'skate';

-- Shop items belong to a world ('skate', 'surf' or 'both')
alter table public.shop_items add column if not exists world text not null default 'skate';
update public.shop_items set world = 'both' where slot = 'character' or (slot, id) in (('pet','shark'),('plant','palm'),('plant','cactus'),('hat','headphones'),('eyes','shades'),('eyes','star'));

insert into public.shop_items (slot, id, name, price, emoji, sort, world) values
  ('hat','bucket','Bucket hat',30,null,20,'surf'), ('hat','visor','Sun visor',35,null,21,'surf'),
  ('hat','straw','Straw hat',45,null,22,'surf'), ('hat','flowercrown','Flower crown',60,null,23,'surf'),
  ('hat','surfhelmet','Big-wave helmet',120,null,24,'surf'),
  ('eyes','mask','Snorkel mask',40,null,20,'surf'), ('eyes','heart','Heart sunnies',70,null,21,'surf'),
  ('neck','lei','Flower lei',30,null,20,'surf'), ('neck','sharktooth','Shark-tooth necklace',55,null,21,'surf'),
  ('neck','whistle','Lifeguard whistle',80,null,22,'surf'),
  ('pet','crab','Crab',50,'🦀',20,'surf'), ('pet','turtle','Sea turtle',80,'🐢',21,'surf'),
  ('pet','seal','Seal',110,'🦭',22,'surf'), ('pet','dolphin','Dolphin',150,'🐬',23,'surf'),
  ('pet','octopus','Octopus',180,'🐙',24,'surf'), ('pet','parrot','Parrot',200,'🦜',25,'surf'),
  ('pet','whale','Whale',400,'🐳',26,'surf'),
  ('plant','shell','Seashell',20,'🐚',20,'surf'), ('plant','coconut','Coconut',30,'🥥',21,'surf'),
  ('plant','hibiscus','Hibiscus',45,'🌺',22,'surf'), ('plant','coral','Coral',70,'🪸',23,'surf'),
  ('gear','buoy','Ring buoy',15,'🛟',20,'surf'), ('gear','volleyball','Volleyball',30,'🏐',21,'surf'),
  ('gear','snorkel','Snorkel set',40,'🤿',22,'surf'), ('gear','kite','Kite',50,'🪁',23,'surf'),
  ('gear','rod','Fishing rod',60,'🎣',24,'surf'), ('gear','watermelon','Watermelon',25,'🍉',25,'surf'),
  ('gear','camera','Camera',80,'📸',26,'surf'), ('gear','canoe','Canoe',150,'🛶',27,'surf')
on conflict (slot, id) do nothing;

-- One live whiteboard per class
create table if not exists public.boards (
  class_id uuid primary key references public.classes(id) on delete cascade,
  text text not null default '',
  strokes jsonb not null default '[]',
  timer_end timestamptz,
  timer_total int not null default 0,
  timer_left int,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.boards enable row level security;
drop policy if exists "read" on public.boards;
create policy "read" on public.boards for select to authenticated using (public.is_teacher() or public.is_enrolled(class_id));
drop policy if exists "teacher" on public.boards;
create policy "teacher" on public.boards for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Send whiteboard changes to students' screens instantly
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards') then
    alter publication supabase_realtime add table public.boards;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Quiet meter, golf and cycling (also shipped as update-5.sql)
-- ---------------------------------------------------------------------

-- Live quiet meter state shown on students' screens
alter table public.boards add column if not exists quiet_on boolean not null default false;
alter table public.boards add column if not exists quiet_animals int not null default 0;
alter table public.boards add column if not exists quiet_level int not null default 0;
alter table public.boards add column if not exists quiet_secs int not null default 0;

-- Finished quiet sessions (count towards class achievements)
create table if not exists public.quiet_sessions (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  minutes int not null,
  animals int not null default 0,
  coins_each int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.quiet_sessions enable row level security;
drop policy if exists "read" on public.quiet_sessions;
create policy "read" on public.quiet_sessions for select to authenticated using (public.is_teacher() or public.is_enrolled(class_id));

-- Teacher ends a quiet session: every student in the class gets the same bonus
create or replace function public.finish_quiet(p_class uuid, p_secs int, p_animals int)
returns int language plpgsql security definer set search_path = public as $$
declare v_min int := least(120, greatest(0, coalesce(p_secs, 0) / 60)); v_an int := least(20, greatest(0, coalesce(p_animals, 0))); v_coins int;
begin
  if not public.is_teacher() then raise exception 'not_teacher'; end if;
  v_coins := least(50, v_min + v_an * 2);
  insert into public.quiet_sessions (class_id, minutes, animals, coins_each) values (p_class, v_min, v_an, v_coins);
  if v_coins > 0 then
    update public.students set earned = earned + v_coins where id in (select student_id from public.enrolments where class_id = p_class);
    insert into public.coin_log (student_id, amount, reason, kind)
      select student_id, v_coins, 'Quiet class bonus (' || v_min || ' min, ' || v_an || ' animals)', 'quiet' from public.enrolments where class_id = p_class;
  end if;
  update public.boards set quiet_on = false, quiet_animals = 0, quiet_level = 0, quiet_secs = 0, updated_at = now() where class_id = p_class;
  return v_coins;
end $$;

-- Achievements can now count quiet minutes and reward rare safari animals
alter table public.achievements drop constraint if exists achievements_metric_check;
alter table public.achievements add constraint achievements_metric_check check (metric in ('focus_hours','quizzes','perfect','members','riders','quiet_minutes'));
alter table public.achievements drop constraint if exists achievements_reward_type_check;
alter table public.achievements add constraint achievements_reward_type_check check (reward_type in ('park','decor','safari'));
insert into public.achievements (key, name, description, metric, threshold, reward_type, reward_id, sort) values
  ('hush_hour',     'Hush Hour',     '10 quiet minutes as a class',  'quiet_minutes', 10,  'safari', 'rhino',    24),
  ('library_lions', 'Library Lions', '30 quiet minutes as a class',  'quiet_minutes', 30,  'safari', 'leopard',  25),
  ('silent_safari', 'Silent Safari', '60 quiet minutes as a class',  'quiet_minutes', 60,  'safari', 'gorilla',  26),
  ('whisper_kings', 'Whisper Kings', '120 quiet minutes as a class', 'quiet_minutes', 120, 'safari', 'flamingo', 27)
on conflict (key) do nothing;

create or replace function public.class_progress(p_class uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_members int; v_focus numeric; v_quiz int; v_perfect int; v_riders int; v_need numeric; v_period text; v_quiet int;
begin
  if not (public.is_teacher() or public.is_enrolled(p_class)) then raise exception 'no_access'; end if;
  select count(*) into v_members from public.enrolments where class_id = p_class;
  select coalesce(sum(s.focus_min), 0) / 60.0 into v_focus
    from public.students s join public.enrolments e on e.student_id = s.id where e.class_id = p_class;
  select count(*), count(*) filter (where a.total > 0 and a.score = a.total) into v_quiz, v_perfect
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.class_id = p_class;
  select coalesce(sum(minutes), 0) into v_quiet from public.quiet_sessions where class_id = p_class;
  select bowl_hours * 60, bowl_period into v_need, v_period from public.settings where id = 1;
  select count(*) into v_riders from (
    select case when v_period = 'all' then s.focus_min
                else coalesce((select sum(f.minutes) from public.focus_sessions f
                               where f.student_id = s.id and f.completed_at >= public.week_start()), 0) end as m
    from public.students s join public.enrolments e on e.student_id = s.id where e.class_id = p_class) x
  where x.m > 0 and x.m >= v_need;
  insert into public.class_unlocks (class_id, key)
    select p_class, a.key from public.achievements a
    where (case a.metric when 'focus_hours' then v_focus when 'quizzes' then v_quiz when 'perfect' then v_perfect
                         when 'members' then v_members when 'riders' then v_riders when 'quiet_minutes' then v_quiet end) >= a.threshold
  on conflict do nothing;
  return json_build_object(
    'stats', json_build_object('focus_hours', round(v_focus, 1), 'quizzes', v_quiz, 'perfect', v_perfect, 'members', v_members, 'riders', v_riders, 'quiet_minutes', v_quiet),
    'unlocks', coalesce((select json_agg(json_build_object('key', key, 'at', unlocked_at, 'by_teacher', by_teacher))
                         from public.class_unlocks where class_id = p_class), '[]'::json));
end $$;

-- Items shared by several worlds
update public.shop_items set world = 'both' where (slot, id) in (('neck','medal'),('plant','sunflower'),('hat','beanie'));

-- Golf pro shop and cycling bike shop
insert into public.shop_items (slot, id, name, price, emoji, sort, world) values
  ('hat','golfcap','Golf cap',30,null,30,'golf'), ('hat','flatcap','Tweed flat cap',45,null,31,'golf'),
  ('hat','tam','Tartan tam',60,null,32,'golf'), ('hat','golfvisor','Pro visor',80,null,33,'golf'),
  ('eyes','aviator','Aviator sunnies',45,null,30,'golf'),
  ('neck','polo','Polo collar',25,null,30,'golf'), ('neck','golftowel','Caddie towel',40,null,31,'golf'),
  ('pet','duck','Duck',50,'🦆',30,'golf'), ('pet','squirrel','Squirrel',70,'🐿️',31,'golf'),
  ('pet','swan','Swan',110,'🦢',32,'golf'), ('pet','rabbit','Rabbit',80,'🐇',33,'golf'),
  ('pet','gator','Alligator',250,'🐊',34,'golf'),
  ('plant','tulip','Tulip',20,'🌷',30,'golf'), ('plant','blossom','Blossom',40,'🌸',31,'golf'),
  ('plant','pine','Pine tree',60,'🌲',32,'golf'), ('plant','clover','Lucky clover',90,'🍀',33,'golf'),
  ('gear','flag','Pin flag',20,'⛳',30,'golf'), ('gear','target','Target',35,'🎯',31,'golf'),
  ('gear','watch','Fancy watch',70,'⌚',32,'golf'), ('gear','trophy','Trophy',200,'🏆',33,'golf'),
  ('hat','roadhelmet','Road helmet',35,null,40,'cycle'), ('hat','cyclingcap','Cycling cap',30,null,41,'cycle'),
  ('hat','aerohelmet','Time-trial helmet',90,null,42,'cycle'), ('hat','laurel','Winner''s laurels',220,null,43,'cycle'),
  ('eyes','wrap','Wraparound shades',45,null,40,'cycle'),
  ('neck','bidon','Water bottle',20,null,40,'cycle'),
  ('pet','dog','Dog',60,'🐕',40,'cycle'), ('pet','goat','Mountain goat',80,'🐐',41,'cycle'),
  ('pet','cow','Alpine cow',100,'🐄',42,'cycle'), ('pet','rooster','Rooster',120,'🐓',43,'cycle'),
  ('pet','eagle','Eagle',300,'🦅',44,'cycle'),
  ('plant','grapes','Grapevine',35,'🍇',40,'cycle'), ('plant','herb','Lavender',45,'🌿',41,'cycle'),
  ('gear','bike','Spare bike',40,'🚲',40,'cycle'), ('gear','baguette','Baguette',15,'🥖',41,'cycle'),
  ('gear','cheese','Cheese',25,'🧀',42,'cycle'), ('gear','stopwatch','Stopwatch',50,'⏱️',43,'cycle'),
  ('gear','map','Route map',60,'🗺️',44,'cycle')
on conflict (slot, id) do nothing;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- =====================================================================
--  LAST STEP (after you've created your teacher login on the website):
--  replace the email below with yours and run just this line:
--
--  insert into public.teachers (user_id) select id from auth.users where email = 'you@school.edu.au';
-- =====================================================================
