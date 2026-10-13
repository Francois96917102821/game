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
  ('22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

set local role authenticated;

do $tests$
declare
  v_result jsonb;
  v_group_id uuid;
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
end
$tests$;

rollback;
