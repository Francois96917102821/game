\set ON_ERROR_STOP on

do $bootstrap$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
end
$bootstrap$;

create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
grant usage on schema auth to public;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to public;

\ir ../schema.sql
\ir ../schema.sql
\ir ../guild-schema.sql
\ir ../guild-schema.sql

begin;

insert into auth.users (id)
values
  ('51111111-1111-4111-8111-111111111111'),
  ('52222222-2222-4222-8222-222222222222'),
  ('53333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

set local role authenticated;

do $tests$
declare
  v_owner constant uuid := '51111111-1111-4111-8111-111111111111';
  v_member constant uuid := '52222222-2222-4222-8222-222222222222';
  v_outsider constant uuid := '53333333-3333-4333-8333-333333333333';
  v_state jsonb;
  v_invite text;
  v_guild_id uuid;
  v_response jsonb;
  v_repeat jsonb;
  v_item_id bigint;
  v_error text;
begin
  if has_function_privilege('anon', 'public.guild_state()', 'execute') or
    not has_function_privilege('authenticated', 'public.guild_state()', 'execute') or
    has_table_privilege('authenticated', 'public.guilds', 'update') or
    not (select relrowsecurity from pg_class where oid = 'public.guild_request_receipts'::regclass) or
    exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace and proname like 'guild_%'
        and not prosecdef
    ) then
    raise exception 'Guild data and RPC permissions are not restricted.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_state := public.guild_create('Сумрачный дозор', 'Хранитель');
  v_guild_id := (v_state -> 'guild' ->> 'id')::uuid;
  v_invite := (public.guild_create_invite() -> 'guild' -> 'invitation' ->> 'code');
  if v_invite is null then raise exception 'Guild invitation was not created.'; end if;

  perform set_config('request.jwt.claim.sub', v_member::text, true);
  v_state := public.guild_join(v_invite, 'Странник');
  if v_state -> 'guild' ->> 'id' <> v_guild_id::text then
    raise exception 'Member did not join the invited guild.';
  end if;
  v_response := public.guild_chat_send('Проверка связи.', 'a1111111-1111-4111-8111-111111111111');
  v_repeat := public.guild_chat_send('Проверка связи.', 'a1111111-1111-4111-8111-111111111111');
  if v_response <> v_repeat then raise exception 'Chat retry duplicated or changed its receipt.'; end if;
  v_error := null;
  begin
    perform public.guild_chat_send('Подмена текста.', 'a1111111-1111-4111-8111-111111111111');
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'A chat request UUID must not be reusable with another body.'; end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.guild_contribute(
    'elite_trophy', 5000, 5000, null, 'a1212121-1212-4121-8121-121212121212'
  );
  perform public.guild_contribute('boards', 200, 200, null, 'a1313131-1313-4131-8131-131313131313');
  perform public.guild_contribute('blocks', 200, 200, null, 'a1414141-1414-4141-8141-141414141414');
  perform public.guild_contribute('cloth', 100, 100, null, 'a1515151-1515-4151-8151-151515151515');
  perform public.guild_contribute('ingots', 100, 100, null, 'a1616161-1616-4161-8161-161616161616');
  perform public.guild_build('castle', 'a2222222-2222-4222-8222-222222222222');
  perform public.guild_build('treasury', 'a3333333-3333-4333-8333-333333333333');
  perform public.guild_build('warehouse', 'a4444444-4444-4444-8444-444444444444');
  perform public.guild_build('healer', 'a5555555-5555-4555-8555-555555555555');
  perform public.guild_build('alchemist', 'a6666666-6666-4666-8666-666666666666');
  perform public.guild_build('statue', 'a7777777-7777-4777-8777-777777777777');

  v_response := public.guild_hall_claim('alchemist', 'a8888888-8888-4888-8888-888888888888');
  v_repeat := public.guild_hall_claim('alchemist', 'a8888888-8888-4888-8888-888888888888');
  if v_response <> v_repeat or (v_response ->> 'health_potions')::integer <> 10 or
    (v_response ->> 'regeneration_potions')::integer <> 1 or
    (v_response ->> 'guild_mask')::integer <> 1 then
    raise exception 'Alchemist award or idempotency is incorrect.';
  end if;

  v_response := public.guild_treasury_move(
    'gold', 1000, 'deposit', 1000, 'a9999999-9999-4999-8999-999999999999'
  );
  v_repeat := public.guild_treasury_move(
    'gold', 1000, 'deposit', 1000, 'a9999999-9999-4999-8999-999999999999'
  );
  if v_response <> v_repeat or (v_response ->> 'net')::integer <> 900 then
    raise exception 'Treasury fee or idempotency is incorrect.';
  end if;
  perform public.guild_treasury_move(
    'gold', 100, 'withdraw', 0, 'b1111111-1111-4111-8111-111111111111'
  );

  v_response := public.guild_contribute(
    'item', 1, 1, '{"id":"gear-71","type":"weapon","name":"Тестовый клинок","bonus":3}'::jsonb,
    'b2222222-2222-4222-8222-222222222222'
  );
  v_item_id := (v_response ->> 'item_id')::bigint;
  v_response := public.guild_storage_take(v_item_id, 'b3333333-3333-4333-8333-333333333333');
  v_repeat := public.guild_storage_take(v_item_id, 'b3333333-3333-4333-8333-333333333333');
  if v_response <> v_repeat or v_response -> 'item' ->> 'name' <> 'Тестовый клинок' then
    raise exception 'Storage withdrawal must be retry-safe.';
  end if;
  if not public.guild_pvp_allowed(v_outsider) then
    raise exception 'Players outside the guild should be eligible for PvP.';
  end if;
end
$tests$;

reset role;

do $setup$
begin
  insert into public.player_groups (id) values ('b4444444-4444-4444-8444-444444444444');
  insert into public.player_group_members (group_id, user_id, nickname, level, in_dungeon)
  values
    ('b4444444-4444-4444-8444-444444444444', '51111111-1111-4111-8111-111111111111', 'Глава', 10, true),
    ('b4444444-4444-4444-8444-444444444444', '52222222-2222-4222-8222-222222222222', 'Согильдиец', 10, true);
end
$setup$;

set local role authenticated;

do $pvp_guard$
declare
  v_player constant jsonb := '{
    "hp":20,"max_hp":20,"attack":5,"armor":0,"accuracy":0.8,
    "concentration":0.5,"agility":0.2,"evasion":0,"regeneration":0,
    "bleeding":0,"infection":0,"potions":0,"revivalChance":0,
    "offhand":"none","focus":0
  }'::jsonb;
  v_error text;
begin
  perform set_config('request.jwt.claim.sub', '51111111-1111-4111-8111-111111111111', true);
  perform public.pvp_start(v_player, 'b5555555-5555-4555-8555-555555555555');
  perform set_config('request.jwt.claim.sub', '52222222-2222-4222-8222-222222222222', true);
  v_error := null;
  begin
    perform public.pvp_start(v_player, 'b6666666-6666-4666-8666-666666666666');
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null or v_error not like '%Нельзя проводить PvP между участниками одной гильдии%' then
    raise exception 'PvP between guildmates was not blocked by its server RPC.';
  end if;
end
$pvp_guard$;

rollback;
