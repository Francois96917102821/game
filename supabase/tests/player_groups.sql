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

begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

set local role authenticated;

do $tests$
declare
  v_result jsonb;
  v_group_id uuid;
  v_battle_id uuid;
  v_invite_code text;
  v_updates jsonb;
  v_ack jsonb;
  v_message text;
begin
  if has_function_privilege('anon', 'public.create_player_group(text,integer)', 'execute') then
    raise exception 'anon must not execute group RPCs';
  end if;
  if not has_function_privilege('authenticated', 'public.create_player_group(text,integer)', 'execute') then
    raise exception 'authenticated must execute group RPCs';
  end if;
  if has_function_privilege('anon', 'public.get_player_group_battle(uuid)', 'execute') or
    has_function_privilege('anon', 'public.player_group_battle_action(uuid,text,uuid)', 'execute') or
    has_function_privilege('anon', 'public.join_player_group_battle(uuid,jsonb)', 'execute') or
    not has_function_privilege(
      'authenticated',
      'public.start_player_group_battle(integer,text,text,text,integer,integer,integer,integer,integer,jsonb)',
      'execute'
    ) or
    not has_function_privilege('authenticated', 'public.get_player_group_battle(uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.player_group_battle_action(uuid,text,uuid)', 'execute') or
    not has_function_privilege('authenticated', 'public.leave_player_group_battle(uuid)', 'execute') or
    exists (
      select 1
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'start_player_group_battle', 'join_player_group_battle',
          'get_player_group_battle', 'player_group_battle_action', 'leave_player_group_battle'
        )
        and not prosecdef
    ) then
    raise exception 'Battle RPC privileges must be limited to authenticated players';
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.create_player_group('Owner', 1);
  v_group_id := (v_result -> 'group' ->> 'id')::uuid;
  v_invite_code := v_result ->> 'invite_code';

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  begin
    perform public.accept_player_group_invite(v_invite_code, 'Partner', 2);
    raise exception using errcode = 'ZX001', message = '2:1 invite should have been rejected';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'Уровни игроков должны отличаться менее чем в 2 раза.' then
        raise exception 'Expected 2:1 invite rejection; got: %', v_message;
      end if;
  end;

  v_result := public.accept_player_group_invite(v_invite_code, 'Partner', 1);
  if jsonb_array_length(v_result -> 'members') <> 2 then
    raise exception 'Invite acceptance should create a two-player group';
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.heartbeat_player_group('Owner', 2, true);
  if (v_result -> 'group' ->> 'id')::uuid <> v_group_id then
    raise exception 'Group should remain active at ratio 2:1';
  end if;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform public.heartbeat_player_group('Partner', 1, true);

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.share_player_group_reward('gold', 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if not coalesce((v_result ->> 'shared')::boolean, false) then
    raise exception 'Reward sharing should work at ratio 2:1';
  end if;
  v_result := public.send_player_group_hint('hint_secret', 4);
  if not coalesce((v_result ->> 'sent')::boolean, false) then
    raise exception 'Hints should work at ratio 2:1';
  end if;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_updates := public.consume_player_group_inbox();
  if public.consume_player_group_inbox() <> v_updates then
    raise exception 'A retry after losing the read response must return the same inbox rows';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_updates) as update_item(value)
    where value ->> 'kind' = 'gold' and (value ->> 'amount')::integer = 1
  ) or not exists (
    select 1 from jsonb_array_elements(v_updates) as update_item(value)
    where value ->> 'kind' = 'hint_secret' and (value ->> 'floor')::integer = 4
  ) then
    raise exception '2:1 reward and hint should reach the partner inbox';
  end if;
  v_ack := public.ack_player_group_inbox(array(
    select item ->> 'id' from jsonb_array_elements(v_updates) as inbox_row(item)
  ));
  if (v_ack ->> 'acknowledged')::integer <> jsonb_array_length(v_updates) then
    raise exception 'Acknowledgement should remove exactly the persisted inbox rows';
  end if;
  v_ack := public.ack_player_group_inbox(array(
    select item ->> 'id' from jsonb_array_elements(v_updates) as inbox_row(item)
  ));
  if (v_ack ->> 'acknowledged')::integer <> 0 then
    raise exception 'Repeated acknowledgement must not affect already acknowledged rows';
  end if;
  if public.consume_player_group_inbox() <> '[]'::jsonb then
    raise exception 'Acknowledged inbox rows must not be redelivered';
  end if;

  perform public.heartbeat_player_group('Partner', 2, true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.heartbeat_player_group('Owner', 5, true);
  if (v_result -> 'group' ->> 'id')::uuid <> v_group_id then
    raise exception 'Group should remain active at ratio 2.5:1';
  end if;
  v_result := public.share_player_group_reward('essence', 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if not coalesce((v_result ->> 'shared')::boolean, false) then
    raise exception 'Reward sharing should work at ratio 2.5:1';
  end if;
  v_result := public.send_player_group_hint('hint_rare', 5);
  if not coalesce((v_result ->> 'sent')::boolean, false) then
    raise exception 'Hints should work at ratio 2.5:1';
  end if;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_updates := public.consume_player_group_inbox();
  if public.consume_player_group_inbox() <> v_updates then
    raise exception 'A retry after losing the 2.5:1 read response must return the same rows';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_updates) as update_item(value)
    where value ->> 'kind' = 'essence' and (value ->> 'amount')::integer = 1
  ) or not exists (
    select 1 from jsonb_array_elements(v_updates) as update_item(value)
    where value ->> 'kind' = 'hint_rare' and (value ->> 'floor')::integer = 5
  ) then
    raise exception '2.5:1 reward and hint should reach the partner inbox';
  end if;
  v_ack := public.ack_player_group_inbox(array(
    select item ->> 'id' from jsonb_array_elements(v_updates) as inbox_row(item)
  ));
  if (v_ack ->> 'acknowledged')::integer <> jsonb_array_length(v_updates) then
    raise exception '2.5:1 inbox rows should be acknowledged after processing';
  end if;

  v_result := public.start_player_group_battle(
    9, 'Хранитель колодца', '☠', 'guardian', 90, 100, 8, 40, 50,
    '{"hp":20,"max_hp":40,"potions":1,"attack":25,"defense":2,"focus":2,"heavy_multiplier":2.5}'::jsonb
  );
  v_battle_id := (v_result ->> 'id')::uuid;
  if v_result ->> 'status' <> 'waiting' or jsonb_array_length(v_result -> 'players') <> 1 then
    raise exception 'Starting a group battle should create a waiting battle for its first player';
  end if;
  if (public.start_player_group_battle(
    9, 'Хранитель колодца', '☠', 'guardian', 90, 100, 8, 40, 50,
    '{"hp":20,"max_hp":40,"potions":1,"attack":25,"defense":2,"focus":2,"heavy_multiplier":2.5}'::jsonb
  ) ->> 'id')::uuid <> v_battle_id then
    raise exception 'Retrying battle creation should reconnect to the existing group battle';
  end if;
  if not exists (
    select 1 from public.player_group_inbox
    where group_id = v_group_id and recipient_id = '22222222-2222-4222-8222-222222222222'
      and kind = 'coop_battle' and battle_id = v_battle_id
  ) then
    raise exception 'Starting a group battle should notify the partner';
  end if;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_updates := public.consume_player_group_inbox();
  if not exists (
    select 1 from jsonb_array_elements(v_updates) as update_item(value)
    where value ->> 'kind' = 'coop_battle' and value ->> 'battle_id' = v_battle_id::text
  ) then
    raise exception 'Partner inbox should include the battle invitation';
  end if;
  v_result := public.join_player_group_battle(
    v_battle_id, '{"hp":30,"max_hp":30,"potions":2,"attack":30,"defense":1,"focus":0,"heavy_multiplier":2.5}'::jsonb
  );
  if v_result ->> 'status' <> 'active' or jsonb_array_length(v_result -> 'players') <> 2 then
    raise exception 'Joining a group battle should activate it for both players';
  end if;
  if public.get_player_group_battle(v_battle_id) ->> 'status' <> 'active' then
    raise exception 'Group members should be able to retrieve a fresh battle snapshot';
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.player_group_battle_action(
    v_battle_id, 'potion', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  );
  if v_result ->> 'status' <> 'active' or (v_result ->> 'round')::integer <> 1 or
    (v_result -> 'players' -> 0 ->> 'potions')::integer <> 0 or
    (v_result -> 'players' -> 0 ->> 'hp')::integer <> 34 then
    raise exception 'Using a potion should update player state and wait for their partner';
  end if;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_result := public.player_group_battle_action(
    v_battle_id, 'attack', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );
  if (v_result ->> 'round')::integer <> 2 then
    raise exception 'The boss should respond after both players have acted';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'boss'
  ) or not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'player' and value ->> 'action' = 'potion'
  ) or not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'player' and value ->> 'action' = 'attack'
  ) then
    raise exception 'The battle log should record both player turns and the boss response';
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.player_group_battle_action(
    v_battle_id, 'heavy', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  );
  if v_result ->> 'status' <> 'victory' or (v_result -> 'boss' ->> 'hp')::integer <> 0 then
    raise exception 'A killing blow should record group victory without a boss response';
  end if;
  if public.player_group_battle_action(
    v_battle_id, 'heavy', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ) <> v_result then
    raise exception 'Retrying the same action request must return its original result';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'player' and value ->> 'action' = 'heavy'
  ) or not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'system' and value ->> 'text' = 'Страж повержен!'
  ) then
    raise exception 'Winning player action and victory should be included in the battle log';
  end if;

  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  v_message := null;
  begin
    perform public.get_player_group_battle(v_battle_id);
  exception
    when others then
      get stacked diagnostics v_message = message_text;
  end;
  if v_message is distinct from 'Совместный бой недоступен для этого аккаунта.' then
    raise exception 'Expected battle read to reject a non-member; got: %', coalesce(v_message, 'no error');
  end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.start_player_group_battle(
    10, 'Певица бездны', '♆', 'guardian', 100, 100, 8, 40, 50,
    '{"hp":40,"max_hp":40,"potions":1,"attack":25,"defense":2,"focus":0,"heavy_multiplier":2.5}'::jsonb
  );
  v_battle_id := (v_result ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_result := public.join_player_group_battle(
    v_battle_id, '{"hp":30,"max_hp":30,"potions":2,"attack":30,"defense":1,"focus":0,"heavy_multiplier":2.5}'::jsonb
  );
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  perform public.player_group_battle_action(v_battle_id, 'guard', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_result := public.player_group_battle_action(
    v_battle_id, 'guard', '99999999-9999-4999-8999-999999999999'
  );
  if not exists (
    select 1 from jsonb_array_elements(v_result -> 'action_log') as log_item(value)
    where value ->> 'type' = 'boss'
  ) then
    raise exception 'The guard action should complete a round and trigger the boss response';
  end if;
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_result := public.leave_player_group_battle(v_battle_id);
  if v_result ->> 'status' <> 'abandoned' then
    raise exception 'Leaving a live battle should mark it abandoned';
  end if;
end
$tests$;

rollback;
