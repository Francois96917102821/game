\set ON_ERROR_STOP on

do $bootstrap$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin';
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

begin;

insert into auth.users (id)
values
  ('41111111-1111-4111-8111-111111111111'),
  ('42222222-2222-4222-8222-222222222222'),
  ('43333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

set local role authenticated;

do $tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_stranger constant uuid := '43333333-3333-4333-8333-333333333333';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1,"skillType":"blast","skillDamage":20,
    "skillCooldownMax":4,"revivalUsed":false,
    "criticalChance":0.1,"executeChance":0.2,"lifesteal":0.3
  }'::jsonb;
  v_partner_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":0,
    "bleeding":0,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_result jsonb;
  v_saved_waiting jsonb;
  v_group_id uuid;
  v_battle_id uuid;
  v_invite text;
  v_error text;
  v_action_request constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_owner_request constant uuid := 'a2222222-2222-4222-8222-222222222222';
  v_partner_request constant uuid := 'a3333333-3333-4333-8333-333333333333';
begin
  if has_function_privilege('anon', 'public.pvp_start(jsonb,uuid)', 'execute') or
    has_function_privilege('anon', 'public.pvp_get(uuid)', 'execute') or
    has_function_privilege('anon', 'public.pvp_find()', 'execute') or
    has_function_privilege('anon', 'public.pvp_action(uuid,integer,text,uuid)', 'execute') or
    has_function_privilege('anon', 'public.pvp_leave(uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.pvp_start(jsonb,uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.pvp_get(uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.pvp_find()', 'execute') or
    not has_function_privilege('authenticated', 'public.pvp_action(uuid,integer,text,uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.pvp_leave(uuid)', 'execute') then
    raise exception 'PvP RPC privileges must be restricted to authenticated players.';
  end if;
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('pvp_start', 'pvp_get', 'pvp_find', 'pvp_action', 'pvp_leave')
      and (not prosecdef or coalesce(array_to_string(proconfig, ','), '') not like '%search_path%')
  ) then
    raise exception 'PvP RPCs must be SECURITY DEFINER with a fixed search_path.';
  end if;
  if has_function_privilege('authenticated', 'public.pvp_validate_player(jsonb)', 'execute') or
    has_function_privilege('authenticated', 'public.pvp_snapshot(uuid)', 'execute') or
    has_function_privilege('authenticated', 'public.pvp_expire_waiting(uuid)', 'execute') or
    has_function_privilege('authenticated', 'public.pvp_skill_chance(numeric,numeric,numeric,numeric)', 'execute') or
    has_function_privilege('authenticated', 'public.pvp_tick_expired(uuid)', 'execute') then
    raise exception 'Internal PvP helper functions must not be executable by authenticated clients.';
  end if;
  if has_table_privilege('authenticated', 'public.pvp_battles', 'select') or
    has_table_privilege('authenticated', 'public.pvp_battles', 'insert') or
    has_table_privilege('authenticated', 'public.pvp_battles', 'update') or
    has_table_privilege('authenticated', 'public.pvp_battles', 'delete') or
    has_table_privilege('authenticated', 'public.pvp_fighters', 'select') or
    has_table_privilege('authenticated', 'public.pvp_fighters', 'insert') or
    has_table_privilege('authenticated', 'public.pvp_fighters', 'update') or
    has_table_privilege('authenticated', 'public.pvp_fighters', 'delete') or
    has_table_privilege('authenticated', 'public.pvp_request_receipts', 'select') or
    has_table_privilege('authenticated', 'public.pvp_request_receipts', 'insert') or
    has_table_privilege('authenticated', 'public.pvp_request_receipts', 'update') or
    has_table_privilege('authenticated', 'public.pvp_request_receipts', 'delete') or
    not (select relrowsecurity from pg_class where oid = 'public.pvp_battles'::regclass) or
    not (select relrowsecurity from pg_class where oid = 'public.pvp_fighters'::regclass) or
    not (select relrowsecurity from pg_class where oid = 'public.pvp_request_receipts'::regclass) then
    raise exception 'PvP tables must be RLS-enabled and inaccessible directly.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.create_player_group('Duelist', 10);
  v_group_id := (v_result -> 'group' ->> 'id')::uuid;
  v_invite := v_result ->> 'invite_code';
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  perform public.accept_player_group_invite(v_invite, 'Partner', 10);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.heartbeat_player_group('Duelist', 10, true);
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  perform public.heartbeat_player_group('Partner', 10, true);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_error := null;
  begin
    perform public.pvp_start(
      jsonb_set(v_player, '{armor}', '0.8'::jsonb),
      'a4444444-4444-4444-8444-444444444444'
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'Out-of-range armor must be rejected.'; end if;
  v_error := null;
  begin
    perform public.pvp_start(
      v_player || '{"skillCooldown":4,"poisonDamage":50,"barrier":999}'::jsonb,
      'a4545454-4444-4444-8444-444444444444'
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'Clients must not supply internal cooldown, poison, or barrier state.';
  end if;

  v_saved_waiting := public.pvp_start(v_player, v_owner_request);
  v_battle_id := (v_saved_waiting ->> 'id')::uuid;
  if v_saved_waiting ->> 'status' <> 'waiting' or
    (v_saved_waiting ->> 'turn')::integer <> 1 or
    jsonb_array_length(v_saved_waiting -> 'players') <> 1 then
    raise exception 'First PvP start must create a one-player forced encounter.';
  end if;
  if public.pvp_start(v_player, v_owner_request) <> v_saved_waiting then
    raise exception 'pvp_start request replay must return its original response.';
  end if;

  v_error := null;
  begin
    perform public.pvp_leave(v_battle_id);
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'A participant must not decline or cancel a waiting PvP encounter.';
  end if;

  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_find();
  if v_result ->> 'id' is distinct from v_battle_id::text or
    v_result ->> 'status' is distinct from 'waiting' or v_result ? 'players' then
    raise exception 'The online partner must discover the forced encounter without a decline choice.';
  end if;
  v_error := null;
  begin
    perform public.pvp_get(v_battle_id);
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'An invitee must not read a battle before joining.'; end if;
  v_result := public.pvp_start(v_partner_player, v_partner_request);
  if v_result ->> 'status' <> 'active' or jsonb_array_length(v_result -> 'players') <> 2 or
    v_result ->> 'current_user_id' <> v_owner::text or
    v_result -> 'players' -> 0 ->> 'max_hp' <> '100' or
    v_result -> 'players' -> 0 ->> 'revival_used' <> 'false' or
    (v_result -> 'players' -> 0 -> 'fighter' ->> 'revivalUsed') <> 'false' or
    (v_result -> 'players' -> 0 ->> 'skillCooldown') <> '0' or
    (v_result -> 'players' -> 0 ->> 'skillCooldownMax') <> '4' or
    (v_result -> 'players' -> 0 ->> 'criticalChance') <> '0.1' or
    jsonb_typeof(v_result -> 'log' -> 0) <> 'string' then
    raise exception 'Joining must activate the duel on turn one for the inviter.';
  end if;
  v_error := null;
  begin
    perform public.start_player_group_battle(
      91, 'PvP exclusion test', '☠', 'guardian', 90, 100, 8, 0, 0,
      '{"hp":40,"max_hp":40,"potions":1,"attack":25,"defense":2,"focus":0,"heavy_multiplier":2.5}'::jsonb
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'Cooperative battle start must be rejected while PvP is waiting or active.';
  end if;

  v_error := null;
  begin
    perform public.pvp_action(
      v_battle_id, 1, 'guard', 'a5555555-5555-4555-8555-555555555555'
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'Out-of-turn action must be rejected.'; end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_action(
    v_battle_id, 1, 'equip-staff', 'a6666666-6666-4666-8666-666666666666'
  );
  if v_result ->> 'status' <> 'active' or (v_result ->> 'turn')::integer <> 2 or
    v_result -> 'players' -> 0 ->> 'offhand' <> 'staff' or
    (v_result -> 'players' -> 1 ->> 'hp')::integer <> 100 then
    raise exception 'Equipment action must consume the turn and update offhand.';
  end if;

  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_action(v_battle_id, 2, 'guard', v_action_request);
  if (v_result ->> 'turn')::integer <> 3 or
    (v_result -> 'players' -> 0 ->> 'hp')::integer <> 99 or
    not exists (
      select 1 from jsonb_array_elements(v_result -> 'log') as log_entry(value)
      where value::text like '%блокировать%'
    ) then
    raise exception 'Guard action must advance the turn and appear in the log.';
  end if;
  if public.pvp_action(v_battle_id, 2, 'guard', v_action_request) <> v_result then
    raise exception 'Action request replay must return the original response.';
  end if;
  v_error := null;
  begin
    perform public.pvp_action(
      v_battle_id, 2, 'attack', v_action_request
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'Reusing an action UUID with a new payload must be rejected.'; end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_action(v_battle_id, 3, 'staff', 'a7777777-7777-4777-8777-777777777777');
  if (v_result ->> 'turn')::integer <> 4 or
    (v_result -> 'players' -> 0 ->> 'staff_cooldown')::integer <> 4 then
    raise exception 'Staff should use its skill roll and retain a four-turn cooldown.';
  end if;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_action(v_battle_id, 4, 'guard', 'a8888888-8888-4888-8888-888888888888');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_action(v_battle_id, 5, 'equip-shield', 'a9999999-9999-4999-8999-999999999999');
  if v_result -> 'players' -> 0 ->> 'offhand' <> 'shield' or
    (v_result -> 'players' -> 0 ->> 'staff_cooldown')::integer <> 3 then
    raise exception 'Equip action must preserve and tick cooldowns independent of offhand.';
  end if;

  perform set_config('request.jwt.claim.sub', v_stranger::text, true);
  v_error := null;
  begin
    perform public.pvp_get(v_battle_id);
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'Nonparticipants must not read PvP state.'; end if;
  begin
    perform count(*) from public.pvp_fighters;
    raise exception using errcode = 'ZX001', message = 'direct fighter read unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when sqlstate 'ZX001' then raise;
  end;
  begin
    insert into public.pvp_battles (group_id) values (v_group_id);
    raise exception using errcode = 'ZX002', message = 'direct PvP write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when sqlstate 'ZX002' then raise;
  end;
end
$tests$;

reset role;

insert into public.player_group_battles (
  id, group_id, floor, status, boss_name, boss_skin, boss_hp, boss_max_hp, boss_damage
)
values (
  '41111111-aaaa-4111-8111-111111111111',
  (select group_id from public.player_group_members
    where user_id = '41111111-1111-4111-8111-111111111111'),
  900, 'waiting', 'Join exclusion test', 'guardian', 90, 100, 8
);

set local role authenticated;

do $coop_join_exclusion$
declare
  v_error text;
begin
  perform set_config('request.jwt.claim.sub', '42222222-2222-4222-8222-222222222222', true);
  v_error := null;
  begin
    perform public.join_player_group_battle(
      '41111111-aaaa-4111-8111-111111111111',
      '{"hp":30,"max_hp":30,"potions":2,"attack":30,"defense":1,"focus":0,"heavy_multiplier":2.5}'::jsonb
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'Cooperative join must be rejected while a PvP duel is active.';
  end if;
end
$coop_join_exclusion$;

reset role;
delete from public.player_group_battles
where id = '41111111-aaaa-4111-8111-111111111111';

update public.player_group_members
set heartbeat_at = now() - interval '76 seconds'
where user_id = '42222222-2222-4222-8222-222222222222';

set local role authenticated;

do $presence_tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_error text;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  if public.pvp_find() is not null then
    raise exception 'Expired group presence must hide PvP invitations.';
  end if;
  v_error := null;
  begin
    perform public.pvp_start(v_player, 'd1111111-1111-4111-8111-111111111111');
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'PvP start must reject a partner whose presence is older than 75 seconds.';
  end if;
end
$presence_tests$;

reset role;

do $chance_tests$
begin
  if public.pvp_skill_chance(0.6, 0.4, 0.5, 0.8) <> 0.49 or
    public.pvp_skill_chance(0, 1.5, 0, 0) <> 0.05 or
    public.pvp_skill_chance(1.5, 0, 1, 1) <> 0.95 then
    raise exception 'PvP skill chance must include concentration, target concentration, agility and accuracy.';
  end if;
end
$chance_tests$;

do $timeout_tests$
declare
  v_battle public.pvp_battles%rowtype;
  v_result jsonb;
  v_count integer := 0;
  v_expired_deadline timestamptz;
begin
  select * into v_battle from public.pvp_battles where status = 'active' limit 1;
  if not found then raise exception 'Expected an active duel for timeout tests.'; end if;
  loop
    if v_count = 0 then
      update public.pvp_battles set deadline_at = now() - interval '10 seconds'
      where id = v_battle.id and status = 'active'
      returning deadline_at into v_expired_deadline;
    else
      update public.pvp_battles set deadline_at = now() - interval '1 second'
      where id = v_battle.id and status = 'active';
    end if;
    exit when not found;
    select * into v_battle from public.pvp_battles where id = v_battle.id;
    perform set_config('request.jwt.claim.sub', v_battle.current_user_id::text, true);
    v_result := public.pvp_get(v_battle.id);
    v_count := v_count + 1;
    if v_count = 1 and
      (v_result ->> 'deadline_at')::timestamptz <> v_expired_deadline + interval '40 seconds' then
      raise exception 'Timeouts must advance from the stored deadline, not from poll time.';
    end if;
    exit when v_result ->> 'status' = 'finished' or v_count > 10;
  end loop;
  if v_result ->> 'status' <> 'finished' or v_result ->> 'reason' <> 'afk' or
    v_count < 5 or v_count > 6 or
    not exists (
      select 1 from jsonb_array_elements(v_result -> 'log') as log_entry(value)
      where value::text like '%трёх пропущенных ходов%'
    ) then
    raise exception 'Expired turns must advance by deadline, settle consecutive skips, and cause an AFK loss.';
  end if;
  if exists (
    select 1 from public.player_group_inbox
    where group_id = v_battle.group_id and kind in ('gold', 'essence')
  ) then
    raise exception 'PvP must not grant gold or shards.';
  end if;
end
$timeout_tests$;

update public.player_group_members
set heartbeat_at = now(), in_dungeon = true
where user_id in (
  '41111111-1111-4111-8111-111111111111',
  '42222222-2222-4222-8222-222222222222'
);

set local role authenticated;

do $forced_encounter_tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_result jsonb;
  v_battle_id uuid;
  v_error text;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_start(v_player, 'b1111111-1111-4111-8111-111111111111');
  v_battle_id := (v_result ->> 'id')::uuid;
  v_error := null;
  begin
    perform public.pvp_leave(v_battle_id);
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then raise exception 'The encounter starter must not cancel a waiting event.'; end if;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_start(v_player, 'b2222222-2222-4222-8222-222222222222');
  v_error := null;
  begin
    perform public.pvp_leave(v_battle_id);
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null or v_result ->> 'status' <> 'active' then
    raise exception 'Neither participant may cancel the active forced encounter.';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_action(
    v_battle_id, 1, 'attack', 'b3333333-3333-4333-8333-333333333333'
  );
  if v_result ->> 'status' <> 'active' or (v_result ->> 'turn')::integer <> 2 then
    raise exception 'The selected attack must continue the encounter into the next turn.';
  end if;
end
$forced_encounter_tests$;

reset role;
update public.pvp_battles
set status = 'finished', current_user_id = null, deadline_at = null, reason = 'test_cleanup'
where id = (
  select battle_id from public.pvp_request_receipts
  where user_id = '42222222-2222-4222-8222-222222222222'
    and request_id = 'b2222222-2222-4222-8222-222222222222'
);
set local role authenticated;

do $periodic_tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_actor jsonb := '{
    "hp":20,"max_hp":20,"attack":1,"armor":0,"accuracy":1,
    "concentration":0.5,"agility":0,"evasion":0,"regeneration":0,
    "bleeding":3,"infection":0,"potions":0,"revivalChance":0,
    "offhand":"none","focus":0
  }'::jsonb;
  v_target jsonb := '{
    "hp":20,"max_hp":20,"attack":1,"armor":0,"accuracy":1,
    "concentration":0.5,"agility":0,"evasion":0,"regeneration":0,
    "bleeding":5,"infection":0,"potions":0,"revivalChance":0,
    "offhand":"none","focus":0
  }'::jsonb;
  v_result jsonb;
  v_battle_id uuid;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.heartbeat_player_group('Duelist', 10, true);
  v_result := public.pvp_start(v_actor, 'c1111111-1111-4111-8111-111111111111');
  v_battle_id := (v_result ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  perform public.heartbeat_player_group('Partner', 10, true);
  v_result := public.pvp_start(v_target, 'c2222222-2222-4222-8222-222222222222');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_action(
    v_battle_id, 1, 'guard', 'c3333333-3333-4333-8333-333333333333'
  );
  if (v_result -> 'players' -> 0 ->> 'hp')::integer <> 20 or
    (v_result -> 'players' -> 1 ->> 'hp')::integer <> 15 then
    raise exception 'Actor regeneration and target bleeding must resolve independently at turn end.';
  end if;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_action(
    v_battle_id, 2, 'guard', 'c4444444-4444-4444-8444-444444444444'
  );
  if (v_result -> 'players' -> 0 ->> 'hp')::integer <> 17 or
    (v_result -> 'players' -> 1 ->> 'hp')::integer <> 15 then
    raise exception 'A fighter''s own bleeding must wait until its opponent takes a turn.';
  end if;
end
$periodic_tests$;

reset role;
update public.pvp_battles
set status = 'finished', current_user_id = null, deadline_at = null, reason = 'test_cleanup'
where id = (
  select battle_id from public.pvp_request_receipts
  where user_id = '42222222-2222-4222-8222-222222222222'
    and request_id = 'c2222222-2222-4222-8222-222222222222'
);

do $stale_waiting_tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_result jsonb;
  v_battle_id uuid;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_start(v_player, 'd1111111-1111-4111-8111-111111111111');
  v_battle_id := (v_result ->> 'id')::uuid;
  update public.pvp_battles
  set created_at = now() - interval '76 seconds'
  where id = v_battle_id;
  v_result := public.pvp_get(v_battle_id);
  if v_result ->> 'status' <> 'finished' or v_result ->> 'reason' <> 'stale' or
    v_result ->> 'winner_id' is not null then
    raise exception 'A waiting event must expire without winner or reward after disconnect.';
  end if;

  v_result := public.pvp_start(v_player, 'd2222222-2222-4222-8222-222222222222');
  v_battle_id := (v_result ->> 'id')::uuid;
  update public.pvp_battles
  set created_at = now() - interval '76 seconds'
  where id = v_battle_id;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  if public.pvp_find() is not null then
    raise exception 'pvp_find must not return an expired waiting encounter.';
  end if;
  if not exists (
    select 1 from public.pvp_battles
    where id = v_battle_id and status = 'finished' and reason = 'stale'
  ) then
    raise exception 'pvp_find must settle stale waiting encounters.';
  end if;
end
$stale_waiting_tests$;

set local role authenticated;

do $pvp_start_exclusion$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_battle jsonb;
  v_error text;
begin
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_battle := public.start_player_group_battle(
    902, 'Co-op exclusion test', '☠', 'guardian', 90, 100, 8, 0, 0,
    '{"hp":40,"max_hp":40,"potions":1,"attack":25,"defense":2,"focus":0,"heavy_multiplier":2.5}'::jsonb
  );
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  perform public.join_player_group_battle(
    (v_battle ->> 'id')::uuid,
    '{"hp":30,"max_hp":30,"potions":2,"attack":30,"defense":1,"focus":0,"heavy_multiplier":2.5}'::jsonb
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_error := null;
  begin
    perform public.pvp_start(v_player, 'e1111111-1111-4111-8111-111111111111');
  exception when others then
    get stacked diagnostics v_error = message_text;
  end;
  if v_error is null then
    raise exception 'PvP start must be rejected while a cooperative duel is waiting or active.';
  end if;
end
$pvp_start_exclusion$;

reset role;

do $group_removal_tests$
declare
  v_owner constant uuid := '41111111-1111-4111-8111-111111111111';
  v_partner constant uuid := '42222222-2222-4222-8222-222222222222';
  v_player jsonb := '{
    "hp":100,"max_hp":100,"attack":20,"armor":0.1,"accuracy":0.9,
    "concentration":0.9,"agility":0.4,"evasion":0.1,"regeneration":1,
    "bleeding":1,"infection":0,"potions":2,"revivalChance":0.2,
    "offhand":"none","focus":1
  }'::jsonb;
  v_group_id uuid;
  v_battle_id uuid;
  v_result jsonb;
begin
  update public.player_group_members
  set heartbeat_at = now(), in_dungeon = true
  where user_id in (v_owner, v_partner);
  update public.player_group_battles
  set status = 'abandoned'
  where group_id = (select group_id from public.player_group_members where user_id = v_owner)
    and status in ('waiting', 'active');
  select group_id into v_group_id
  from public.player_group_members where user_id = v_owner;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_start(v_player, 'f1111111-1111-4111-8111-111111111111');
  v_battle_id := (v_result ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_partner::text, true);
  v_result := public.pvp_start(v_player, 'f2222222-2222-4222-8222-222222222222');
  if v_result ->> 'status' <> 'active' then raise exception 'Expected active PvP before group removal.'; end if;

  delete from public.player_groups where id = v_group_id;
  if not exists (
    select 1 from public.pvp_battles
    where id = v_battle_id and group_id is null and status = 'active'
  ) or (select count(*) from public.pvp_fighters where battle_id = v_battle_id) <> 2 then
    raise exception 'Dissolving a group must not delete or cancel its active PvP encounter.';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.pvp_get(v_battle_id);
  v_result := public.pvp_action(
    v_battle_id, 1, 'attack', 'f3333333-3333-4333-8333-333333333333'
  );
  if v_result ->> 'status' <> 'active' or (v_result ->> 'turn')::integer <> 2 then
    raise exception 'An active encounter must keep resolving after group removal.';
  end if;
end
$group_removal_tests$;

rollback;
