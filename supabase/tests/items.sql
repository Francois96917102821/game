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
create extension if not exists dblink;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
grant usage on schema auth to public;
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to public;

\ir ../schema.sql
\ir ../schema.sql

insert into auth.users(id) values
  ('61111111-1111-4111-8111-111111111111'),
  ('62222222-2222-4222-8222-222222222222')
on conflict do nothing;

-- Invoker rights deliberately preserve the role under test.
create function public.item_test_reject(p_sql text, p_state text, p_message text default null)
returns void language plpgsql as $$
declare v_state text; v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  if v_state is distinct from p_state or
    (p_message is not null and v_message is distinct from p_message) then
    raise exception 'Expected rejection % (%), got % (%) for %',
      p_state, p_message, v_state, v_message, p_sql;
  end if;
end;
$$;

do $privileges$
declare v_role text; v_table text; v_privilege text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    foreach v_table in array array['player_items', 'item_issuance_receipts'] loop
      foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(v_role, 'public.' || v_table, v_privilege) then
          raise exception 'Unexpected % % grant to %', v_table, v_privilege, v_role;
        end if;
      end loop;
      if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) or
        exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table) then
        raise exception 'Item tables must have deny-by-default RLS';
      end if;
    end loop;
    if has_function_privilege(v_role, 'public.item_register_issuance(uuid,uuid,jsonb,text,text)', 'EXECUTE')
      <> (v_role = 'service_role') or
      has_function_privilege(v_role, 'public.item_get_owned()', 'EXECUTE') <> (v_role = 'authenticated') or
      has_function_privilege(v_role, 'public.item_is_ordinary_gear(jsonb)', 'EXECUTE') then
      raise exception 'Unexpected item RPC grant to %', v_role;
    end if;
    execute format('set local role %I', v_role);
    perform public.item_test_reject('select * from public.player_items', '42501');
    perform public.item_test_reject('select * from public.item_issuance_receipts', '42501');
    perform public.item_test_reject('insert into public.player_items default values', '42501');
    perform public.item_test_reject('update public.player_items set custody_state = ''escrow''', '42501');
    perform public.item_test_reject('delete from public.player_items', '42501');
    perform public.item_test_reject('insert into public.item_issuance_receipts default values', '42501');
    perform public.item_test_reject('update public.item_issuance_receipts set source_ref = ''forged''', '42501');
    perform public.item_test_reject('delete from public.item_issuance_receipts', '42501');
    if v_role <> 'service_role' then
      -- Forging JWT role/sub must not confer the database service-role grant.
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
      perform public.item_test_reject(
        'select public.item_register_issuance(null,null,null,null,null)', '42501');
    end if;
    reset role;
  end loop;
  if exists (
    select 1 from pg_proc where oid in (
      'public.item_register_issuance(uuid,uuid,jsonb,text,text)'::regprocedure,
      'public.item_get_owned()'::regprocedure)
    and (not prosecdef or not proconfig @> array['search_path=""', 'row_security=off'])
  ) then
    raise exception 'Item RPCs must pin definer search path and RLS settings';
  end if;
end
$privileges$;

set role service_role;
do $issuance$
declare
  v_owner uuid := '61111111-1111-4111-8111-111111111111';
  v_item uuid := 'a1111111-1111-4111-8111-111111111111';
  v_gear jsonb := '{"id":"gear-1","type":"weapon","name":"Клинок каменного эха","bonus":3}';
  v_bad jsonb;
  v_call text;
begin
  if public.item_register_issuance(v_item, v_owner, v_gear, 'test', 'first') <> v_item or
    public.item_register_issuance(v_item, v_owner, v_gear, 'test', 'first') <> v_item then
    raise exception 'Exact retry must preserve item UUID';
  end if;
  -- Each immutable parameter must be checked, not just the receipt key.
  foreach v_call in array array[
    format('select public.item_register_issuance(%L,%L,%L,''test'',''first'')',
      v_item, '62222222-2222-4222-8222-222222222222', v_gear),
    format('select public.item_register_issuance(%L,%L,%L,''test'',''first'')',
      'a2222222-2222-4222-8222-222222222222', v_owner, v_gear),
    format('select public.item_register_issuance(%L,%L,%L,''test'',''first'')',
      v_item, v_owner, v_gear || '{"bonus":4}'),
    format('select public.item_register_issuance(%L,%L,%L,''test'',''first'')',
      v_item, v_owner, v_gear || '{"id":"gear-2"}')
  ] loop
    perform public.item_test_reject(v_call, 'P0001',
      'Item issuance source already registered with different parameters.');
  end loop;
  perform public.item_test_reject(format(
    'select public.item_register_issuance(%L,%L,%L,''test'',''duplicate-id'')',
    v_item, v_owner, v_gear), '23505');
  foreach v_bad in array array[
    null::jsonb, 'null'::jsonb, '[]'::jsonb, '{}'::jsonb,
    v_gear - 'bonus', v_gear || '{"bonus":null}', v_gear || '{"bonus":"3"}',
    v_gear || '{"bonus":0}', v_gear || '{"bonus":7}', v_gear || '{"bonus":1.5}',
    v_gear || '{"id":1}', v_gear || '{"id":"soul-time-forged"}',
    v_gear || '{"type":"soul"}', v_gear || '{"type":"quest"}',
    v_gear || '{"name":"Premium blade"}', v_gear || '{"bound":false}',
    v_gear || '{"premium":false}', v_gear || '{"quest":true}',
    v_gear || '{"type":"armor","name":"Кованый доспех","bonus":5}',
    v_gear || '{"type":"armor"}'
  ] loop
    perform public.item_test_reject(format(
      'select public.item_register_issuance(%L,%L,%L,''test'',''forged'')',
      'a2222222-2222-4222-8222-222222222222', v_owner, v_bad), 'P0001',
      'Invalid trusted item issuance parameters.');
  end loop;
  perform public.item_test_reject(format(
    'select public.item_register_issuance(%L,%L,%L,''test'',''unknown-owner'')',
    'a2222222-2222-4222-8222-222222222222',
    '69999999-9999-4999-8999-999999999999', v_gear), 'P0001', 'Item owner not found.');
  perform public.item_register_issuance('a2222222-2222-4222-8222-222222222222',
    '62222222-2222-4222-8222-222222222222',
    '{"id":"gear-1","type":"armor","name":"Кованый доспех","bonus":4}', 'test', 'second');
end
$issuance$;
reset role;

set role authenticated;
do $visibility$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.item_test_reject('select public.item_get_owned()', 'P0001', 'Authentication required.');
  perform set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
  v_result := public.item_get_owned();
  if jsonb_array_length(v_result) <> 1 or v_result -> 0 ->> 'item_id' <> 'a1111111-1111-4111-8111-111111111111' or
    v_result -> 0 ->> 'custody_state' <> 'owned' then
    raise exception 'Owner must see exactly their asset in owned custody';
  end if;
  perform set_config('request.jwt.claim.sub', '62222222-2222-4222-8222-222222222222', true);
  v_result := public.item_get_owned();
  if jsonb_array_length(v_result) <> 1 or v_result -> 0 ->> 'item_id' <> 'a2222222-2222-4222-8222-222222222222' then
    raise exception 'Cross-user item visibility';
  end if;
end
$visibility$;
reset role;

-- Even an accidental future SELECT grant must not open direct table access.
begin;
grant select on public.player_items, public.item_issuance_receipts to authenticated;
set local role authenticated;
do $rls$
begin
  perform set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
  if exists (select 1 from public.player_items) or exists (select 1 from public.item_issuance_receipts) then
    raise exception 'RLS exposed item storage';
  end if;
end
$rls$;
rollback;

create function public.item_test_fail_insert()
returns trigger language plpgsql as $$
begin
  if new.item_id = 'a3333333-3333-4333-8333-333333333333' then
    raise exception 'Injected custody insert failure.';
  end if;
  return new;
end;
$$;
create trigger item_test_fail_insert before insert on public.player_items
  for each row execute function public.item_test_fail_insert();
set role service_role;
select public.item_test_reject(
  $$select public.item_register_issuance('a3333333-3333-4333-8333-333333333333',
    '61111111-1111-4111-8111-111111111111',
    '{"id":"gear-3","type":"weapon","name":"Якорный тесак","bonus":6}', 'test', 'rollback')$$,
  'P0001', 'Injected custody insert failure.');
reset role;
do $rollback_check$
begin
  if exists (select 1 from public.item_issuance_receipts where source_ref in ('rollback', 'duplicate-id', 'forged', 'unknown-owner')) or
    exists (select 1 from public.player_items where item_id = 'a3333333-3333-4333-8333-333333333333') then
    raise exception 'Failed issuance left an orphan receipt or asset';
  end if;
end
$rollback_check$;
drop trigger item_test_fail_insert on public.player_items;
drop function public.item_test_fail_insert();

-- Each case is a separate top-level transaction: assertions acquire read locks
-- that must be released before the next connection takes the exclusive gate.
set statement_timeout = '30s';
create function public.item_test_concurrency(v_case integer)
returns void language plpgsql as $concurrency$
declare
  v_connection text := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=local-test-only',
    current_setting('port'), current_database());
  v_item uuid; v_query text; v_a text; v_b text;
  v_deadline timestamptz; v_error text;
begin
  perform dblink_connect('item_blocker', v_connection || ' options=''-c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_connect('item_a', v_connection || ' application_name=item_test_a options=''-c role=service_role -c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_connect('item_b', v_connection || ' application_name=item_test_b options=''-c role=service_role -c lock_timeout=10s -c statement_timeout=15s''');
    v_item := case v_case
      when 1 then 'a4444444-4444-4444-8444-444444444444'::uuid
      when 2 then 'a5555555-5555-4555-8555-555555555555'::uuid
      else 'a6666666-6666-4666-8666-666666666666'::uuid end;
    v_query := format(
      'select public.item_register_issuance(%L,''61111111-1111-4111-8111-111111111111'', ' ||
      '''{"id":"gear-4","type":"weapon","name":"Серп живых корней","bonus":2}''::jsonb, ''test'', %L)::text',
      v_item, 'concurrent-' || v_case);
    perform dblink_exec('item_blocker', 'begin');
    perform dblink_exec('item_blocker', 'lock table public.item_issuance_receipts in access exclusive mode');
    perform dblink_send_query('item_a', v_query);
    perform dblink_send_query('item_b', case v_case
      when 2 then replace(v_query, 'concurrent-2', 'concurrent-2-other')
      when 3 then replace(v_query, '"bonus":2', '"bonus":3')
      else v_query end);
    v_deadline := clock_timestamp() + interval '10 seconds';
    while (select count(*) from pg_stat_activity
      where application_name in ('item_test_a', 'item_test_b') and wait_event_type = 'Lock') <> 2 loop
      if clock_timestamp() > v_deadline then
        raise exception 'Both concurrent issuances did not reach the lock';
      end if;
      perform pg_sleep(0.05);
      perform pg_stat_clear_snapshot();
    end loop;
    perform dblink_exec('item_blocker', 'commit');
    select value into v_a from dblink_get_result('item_a', false) as result(value text);
    select value into v_b from dblink_get_result('item_b', false) as result(value text);
    if v_case = 1 then
      if v_a is distinct from v_item::text or v_b is distinct from v_a then
        raise exception 'Concurrent exact retry must return one identity to both callers';
      end if;
    elsif (case when v_a is not null then 1 else 0 end) +
      (case when v_b is not null then 1 else 0 end) <> 1 then
      raise exception 'Conflicting concurrent issuance must fail one caller';
    end if;
    if v_case > 1 then
      v_error := dblink_error_message(case when v_a is null then 'item_a' else 'item_b' end);
      if (v_case = 2 and position('item_issuance_receipts_pkey' in v_error) = 0) or
        (v_case = 3 and position('Item issuance source already registered with different parameters.' in v_error) = 0) then
        raise exception 'Unexpected concurrent rejection: %', v_error;
      end if;
    end if;
    if (select count(*) from public.player_items where item_id = v_item) <> 1 or
      (select count(*) from public.item_issuance_receipts where item_id = v_item) <> 1 then
      raise exception 'Concurrent issuance duplicated or lost an asset/receipt';
    end if;
    -- Drain the empty trailing result before reusing each connection.
    perform * from dblink_get_result('item_a', false) as result(value text);
    perform * from dblink_get_result('item_b', false) as result(value text);
  perform dblink_disconnect('item_a');
  perform dblink_disconnect('item_b');
  perform dblink_disconnect('item_blocker');
end
$concurrency$;
select public.item_test_concurrency(1);
select public.item_test_concurrency(2);
select public.item_test_concurrency(3);
drop function public.item_test_concurrency(integer);
reset statement_timeout;

delete from public.player_items where owner_id in (
  '61111111-1111-4111-8111-111111111111', '62222222-2222-4222-8222-222222222222');
delete from public.item_issuance_receipts where issued_owner_id in (
  '61111111-1111-4111-8111-111111111111', '62222222-2222-4222-8222-222222222222');
drop function public.item_test_reject(text, text, text);
