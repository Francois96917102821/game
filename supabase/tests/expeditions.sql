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

set statement_timeout = '30s';
set lock_timeout = '10s';
insert into auth.users(id) values
  ('71111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222'),
  ('73333333-3333-4333-8333-333333333333')
on conflict do nothing;

create function public.expedition_test_reject(p_sql text, p_state text, p_message text default null)
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
    raise exception 'Expected % (%), got % (%) for %', p_state, p_message, v_state, v_message, p_sql;
  end if;
end;
$$;

do $privileges$
declare v_role text; v_table text; v_privilege text; v_rpc text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    foreach v_table in array array['guild_expeditions', 'guild_expedition_rewards'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role, 'public.' || v_table, v_privilege) then
          raise exception 'Unexpected % % grant to %', v_table, v_privilege, v_role;
        end if;
      end loop;
      if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) or
        exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table) then
        raise exception 'Expedition tables must have deny-default RLS';
      end if;
    end loop;
    foreach v_rpc in array array[
      'guild_expedition_start(uuid,text)', 'guild_expedition_claim(uuid)', 'guild_expedition_get_owned()'
    ] loop
      if has_function_privilege(v_role, 'public.' || v_rpc, 'EXECUTE') <> (v_role = 'authenticated') then
        raise exception 'Unexpected RPC grant % to %', v_rpc, v_role;
      end if;
      if exists (select 1 from pg_proc where oid = ('public.' || v_rpc)::regprocedure
        and (not prosecdef or not proconfig @> array['search_path=""','row_security=off'])) then
        raise exception 'Unpinned security definer RPC %', v_rpc;
      end if;
    end loop;
    execute format('set local role %I', v_role);
    perform public.expedition_test_reject('select * from public.guild_expeditions', '42501');
    perform public.expedition_test_reject('insert into public.guild_expeditions default values', '42501');
    perform public.expedition_test_reject('update public.guild_expeditions set ready_at = now()', '42501');
    perform public.expedition_test_reject('delete from public.guild_expeditions', '42501');
    perform public.expedition_test_reject('select * from public.guild_expedition_rewards', '42501');
    perform public.expedition_test_reject('insert into public.guild_expedition_rewards values (1,25)', '42501');
    perform public.expedition_test_reject('update public.guild_expedition_rewards set gold = 25', '42501');
    perform public.expedition_test_reject('delete from public.guild_expedition_rewards', '42501');
    if v_role <> 'authenticated' then
      perform public.expedition_test_reject('select public.guild_expedition_start(gen_random_uuid())', '42501');
      perform public.expedition_test_reject('select public.guild_expedition_claim(null)', '42501');
      perform public.expedition_test_reject('select public.guild_expedition_get_owned()', '42501');
    end if;
    if v_role <> 'service_role' then
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.expedition_test_reject('select public.wallet_register_funding_receipt(null,null,null,null,null)', '42501');
      perform public.expedition_test_reject('select public.item_register_issuance(null,null,null,null,null)', '42501');
    end if;
    reset role;
  end loop;
end
$privileges$;

do $catalog$
begin
  if (select sum(weight) from public.guild_expedition_rewards) <> 30 or
    (select sum(weight) from public.guild_expedition_rewards where gear is not null) <> 6 or
    (select count(*) from public.guild_expedition_rewards where gear is not null) <> 2 or
    exists (select 1 from public.guild_expedition_rewards
      where gear is not null and (not public.item_is_ordinary_gear(gear) or (gear ->> 'bonus')::integer <> 1)) then
    raise exception 'Expected a 20 percent low-level ordinary gear catalog';
  end if;
end
$catalog$;

set role authenticated;
do $start$
declare v_first jsonb; v_id uuid;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.expedition_test_reject('select public.guild_expedition_start(gen_random_uuid())', 'P0001', 'Authentication required.');
  perform public.expedition_test_reject('select public.guild_expedition_claim(null)', 'P0001', 'Authentication required.');
  perform public.expedition_test_reject('select public.guild_expedition_get_owned()', 'P0001', 'Authentication required.');
  perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
  perform public.expedition_test_reject('select public.guild_expedition_start(null)', 'P0001', 'Request UUID required.');
  perform public.expedition_test_reject('select public.guild_expedition_start(gen_random_uuid(),''forged'')', 'P0001', 'Unknown expedition route.');
  v_first := public.guild_expedition_start('b1111111-1111-4111-8111-111111111111');
  v_id := (v_first ->> 'id')::uuid;
  if public.guild_expedition_start('b1111111-1111-4111-8111-111111111111') <> v_first or
    (v_first ->> 'ready_at')::timestamptz - (v_first ->> 'started_at')::timestamptz <> interval '1 hour' or
    abs(extract(epoch from clock_timestamp() - (v_first ->> 'started_at')::timestamptz)) > 5 then
    raise exception 'Start retry, server time or duration mismatch';
  end if;
  perform public.expedition_test_reject(
    $$select public.guild_expedition_start('b1111111-1111-4111-8111-111111111111','forged')$$,
    'P0001', 'Request UUID was already used with a different payload.');
  perform public.expedition_test_reject('select public.guild_expedition_start(gen_random_uuid())', 'P0001', 'Claim the previous expedition first.');
  perform public.expedition_test_reject(format('select public.guild_expedition_claim(%L)', v_id), 'P0001', 'Expedition is not ready.');
  if public.guild_expedition_get_owned() -> 'balances' <> '{"gold":0,"shard":0}'::jsonb or
    public.guild_expedition_get_owned() -> 'expeditions' <> jsonb_build_array(v_first) then
    raise exception 'Own-read must show running expedition and no early reward';
  end if;
  perform set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
  perform public.expedition_test_reject(format('select public.guild_expedition_claim(%L)', v_id), 'P0001', 'Expedition not found.');
  if public.guild_expedition_get_owned() -> 'expeditions' <> '[]'::jsonb then
    raise exception 'Cross-user expedition visibility';
  end if;
  -- Same request UUID is independent for a second account.
  perform public.guild_expedition_start('b1111111-1111-4111-8111-111111111111');
end
$start$;
reset role;

begin;
grant select on public.guild_expeditions, public.guild_expedition_rewards to authenticated;
set local role authenticated;
do $rls$
begin
  perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
  if exists (select 1 from public.guild_expeditions) or exists (select 1 from public.guild_expedition_rewards) then
    raise exception 'RLS exposed expedition storage';
  end if;
end
$rls$;
rollback;

-- Only the test administrator advances fixtures; no client time override exists.
update public.guild_expeditions
set started_at = started_at - interval '2 hours', ready_at = ready_at - interval '2 hours';

-- Force individual outcomes administratively, never via the client RPC.
update public.guild_expedition_rewards set weight = case when reward_id = 4 then 1 else 0 end;

create function public.expedition_test_fail_ledger()
returns trigger language plpgsql as $$
begin
  if new.user_id = '71111111-1111-4111-8111-111111111111' then
    raise exception 'Injected expedition journal failure.';
  end if;
  return new;
end;
$$;
create trigger expedition_test_fail_ledger before insert on public.wallet_ledger_entries
for each row execute function public.expedition_test_fail_ledger();
set role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', false);
select public.expedition_test_reject(
  format('select public.guild_expedition_claim(%L)', public.guild_expedition_get_owned() -> 'expeditions' -> 0 ->> 'id'),
  'P0001', 'Injected expedition journal failure.');
reset role;
do $rollback$
begin
  if exists (select 1 from public.guild_expeditions where claimed_at is not null) or
    exists (select 1 from public.wallet_funding_receipts where source_kind = 'guild_expedition') or
    exists (select 1 from public.wallet_balances where user_id = '71111111-1111-4111-8111-111111111111') or
    exists (select 1 from public.wallet_transactions where actor_id = '71111111-1111-4111-8111-111111111111') or
    exists (select 1 from public.item_issuance_receipts where source_kind = 'guild_expedition') or
    exists (select 1 from public.player_items where owner_id = '71111111-1111-4111-8111-111111111111') then
    raise exception 'Failed claim left expedition, receipt, balance or transaction changes';
  end if;
end
$rollback$;
drop trigger expedition_test_fail_ledger on public.wallet_ledger_entries;
drop function public.expedition_test_fail_ledger();

create function public.expedition_test_fail_item()
returns trigger language plpgsql as $$
begin
  if new.owner_id = '71111111-1111-4111-8111-111111111111' then
    raise exception 'Injected expedition custody failure.';
  end if;
  return new;
end;
$$;
create trigger expedition_test_fail_item before insert on public.player_items
for each row execute function public.expedition_test_fail_item();
set role authenticated;
select public.expedition_test_reject(
  format('select public.guild_expedition_claim(%L)', public.guild_expedition_get_owned() -> 'expeditions' -> 0 ->> 'id'),
  'P0001', 'Injected expedition custody failure.');
reset role;
do $item_rollback$
begin
  if exists (select 1 from public.guild_expeditions where claimed_at is not null or claim_response is not null) or
    exists (select 1 from public.wallet_funding_receipts where source_kind = 'guild_expedition') or
    exists (select 1 from public.wallet_balances where user_id = '71111111-1111-4111-8111-111111111111') or
    exists (select 1 from public.wallet_transactions where actor_id = '71111111-1111-4111-8111-111111111111') or
    exists (select 1 from public.wallet_ledger_entries where user_id = '71111111-1111-4111-8111-111111111111') or
    exists (select 1 from public.item_issuance_receipts where source_kind = 'guild_expedition') or
    exists (select 1 from public.player_items where owner_id = '71111111-1111-4111-8111-111111111111') then
    raise exception 'Custody failure did not roll back gold, item receipt, asset and claim';
  end if;
end
$item_rollback$;
drop trigger expedition_test_fail_item on public.player_items;
drop function public.expedition_test_fail_item();
update public.guild_expedition_rewards set weight = case when reward_id = 1 then 1 else 0 end;

set role authenticated;
do $claim$
declare v_id uuid; v_claim jsonb; v_start jsonb;
begin
  perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
  v_id := (public.guild_expedition_get_owned() -> 'expeditions' -> 0 ->> 'id')::uuid;
  if public.guild_expedition_get_owned() -> 'expeditions' -> 0 ->> 'status' <> 'ready' then
    raise exception 'Elapsed expedition must be ready';
  end if;
  v_start := public.guild_expedition_start('b1111111-1111-4111-8111-111111111111');
  v_claim := public.guild_expedition_claim(v_id);
  if v_claim -> 'item' is distinct from 'null'::jsonb or
    public.item_get_owned() <> '[]'::jsonb or
    public.guild_expedition_claim(v_id) <> v_claim or
    public.guild_expedition_start('b1111111-1111-4111-8111-111111111111') <> v_start or
    public.guild_expedition_get_owned() -> 'expeditions' <> jsonb_build_array(v_claim) or
    public.wallet_get_balances() ->> 'gold' <> v_claim ->> 'gold' or
    public.wallet_claim_funding_receipts() -> 'claimed_receipts' <> '[]'::jsonb then
    raise exception 'Claim or start retry changed result or credited twice';
  end if;
end
$claim$;
reset role;

-- Model a pre-item claim's exact shape, then prove schema reapplication does not
-- backfill items, alter its response, or re-credit its gold.
update public.guild_expeditions set claim_response = claim_response - 'item'
where user_id = '71111111-1111-4111-8111-111111111111';
create temporary table expedition_legacy_snapshot as
select id, claim_response from public.guild_expeditions where claimed_at is not null;
\ir ../schema.sql
\ir ../schema.sql
set role authenticated;
do $legacy$
begin
  perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
  if public.guild_expedition_get_owned() -> 'expeditions' -> 0 ? 'item' or
    public.item_get_owned() <> '[]'::jsonb or
    public.wallet_get_balances() ->> 'gold' <> '15' then
    raise exception 'Reapplication changed legacy claim or assets';
  end if;
end
$legacy$;
reset role;
do $legacy_retry$
declare v_e record;
begin
  for v_e in select * from expedition_legacy_snapshot loop
    perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
    set local role authenticated;
    if public.guild_expedition_claim(v_e.id) is distinct from v_e.claim_response then
      raise exception 'Legacy retry changed saved response';
    end if;
    reset role;
  end loop;
  if exists (select 1 from public.item_issuance_receipts where source_kind = 'guild_expedition') then
    raise exception 'Legacy claim received a retroactive item';
  end if;
end
$legacy_retry$;
drop table expedition_legacy_snapshot;
update public.guild_expedition_rewards set weight = case when reward_id = 5 then 1 else 0 end;

-- Three committed starts on the current UTC day block a fourth, not an exact retry.
-- Claimed fixtures reuse real claims and receipts, preserving storage constraints.
do $daily$
declare v_start jsonb; v_id uuid; v_request uuid; v_i integer;
begin
  perform set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
  for v_i in 1..3 loop
    v_request := gen_random_uuid();
    set local role authenticated;
    v_start := public.guild_expedition_start(v_request);
    reset role;
    v_id := (v_start ->> 'id')::uuid;
    update public.guild_expeditions
    set started_at = started_at - interval '2 hours', ready_at = ready_at - interval '2 hours' where id = v_id;
    set local role authenticated;
    perform public.guild_expedition_claim(v_id);
    reset role;
    -- Restore UTC-day attribution even when the test runs near midnight.
    update public.guild_expeditions
    set started_at = date_trunc('day', now() at time zone 'UTC') at time zone 'UTC',
      ready_at = (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '1 hour',
      claimed_at = now() + interval '1 hour'
    where id = v_id;
  end loop;
  set local role authenticated;
  perform public.expedition_test_reject('select public.guild_expedition_start(gen_random_uuid())', 'P0001', 'Daily expedition limit reached.');
  if public.guild_expedition_start(v_request) <> v_start then
    raise exception 'Daily limit blocked exact retry';
  end if;
  reset role;
  update public.guild_expeditions set started_at = started_at - interval '24 hours',
    ready_at = ready_at - interval '24 hours'
  where user_id = '73333333-3333-4333-8333-333333333333';
  set local role authenticated;
  perform public.guild_expedition_start(gen_random_uuid());
  reset role;
end
$daily$;

update public.guild_expedition_rewards set weight = case when reward_id = 4 then 1 else 0 end;

-- Separate top-level transactions prevent parent assertions retaining locks
-- when the next dblink case acquires its gate.
create function public.expedition_test_concurrency(p_case integer)
returns void language plpgsql as $concurrency$
declare
  v_connection text := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=local-test-only',
    current_setting('port'), current_database());
  v_query text; v_a text; v_b text; v_deadline timestamptz; v_id uuid;
begin
  perform dblink_connect('exp_blocker', v_connection || ' options=''-c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_connect('exp_a', v_connection || ' application_name=exp_test_a options=''-c role=authenticated -c request.jwt.claim.sub=72222222-2222-4222-8222-222222222222 -c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_connect('exp_b', v_connection || ' application_name=exp_test_b options=''-c role=authenticated -c request.jwt.claim.sub=72222222-2222-4222-8222-222222222222 -c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_exec('exp_blocker', 'begin');
  perform dblink_exec('exp_blocker', 'lock table public.guild_expeditions in access exclusive mode');
  if p_case = 1 then
    select id into v_id from dblink('exp_blocker',
      $$select id from public.guild_expeditions where user_id = '72222222-2222-4222-8222-222222222222'$$) as e(id uuid);
    v_query := format('select public.guild_expedition_claim(%L)::text', v_id);
  else
    v_query := $$select public.guild_expedition_start('c1111111-1111-4111-8111-111111111111')::text$$;
  end if;
  perform dblink_send_query('exp_a', v_query);
  perform dblink_send_query('exp_b', case when p_case = 3
    then replace(v_query, 'c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222')
    else v_query end);
  v_deadline := clock_timestamp() + interval '10 seconds';
  while (select count(*) from pg_stat_activity
    where application_name in ('exp_test_a','exp_test_b') and wait_event_type = 'Lock') <> 2 loop
    if clock_timestamp() > v_deadline then raise exception 'Concurrent calls did not reach lock'; end if;
    perform pg_sleep(0.05);
    perform pg_stat_clear_snapshot();
  end loop;
  perform dblink_exec('exp_blocker', 'commit');
  select value into v_a from dblink_get_result('exp_a', false) as result(value text);
  select value into v_b from dblink_get_result('exp_b', false) as result(value text);
  if p_case < 3 then
    if v_a is null or v_b is distinct from v_a then raise exception 'Concurrent retries diverged'; end if;
  else
    if (case when v_a is not null then 1 else 0 end) + (case when v_b is not null then 1 else 0 end) <> 1 or
      position('Claim the previous expedition first.' in
        dblink_error_message(case when v_a is null then 'exp_a' else 'exp_b' end)) = 0 then
      raise exception 'Concurrent distinct starts bypassed limit';
    end if;
  end if;
  if p_case = 1 and
    (select count(*) from public.wallet_funding_receipts where source_kind = 'guild_expedition' and source_ref = v_id::text) <> 1 then
    raise exception 'Concurrent claims must mint exactly one receipt';
  end if;
  if p_case = 1 then
    if v_a::jsonb -> 'item' ->> 'item_id' is distinct from
        md5('guild-expedition-item:' || v_id::text)::uuid::text or
      (select count(*) from public.item_issuance_receipts
        where source_kind = 'guild_expedition' and source_ref = v_id::text) <> 1 or
      (select count(*) from public.player_items
        where item_id = (v_a::jsonb -> 'item' ->> 'item_id')::uuid
          and owner_id = '72222222-2222-4222-8222-222222222222') <> 1 then
      raise exception 'Concurrent claims must issue exactly one deterministic item to caller';
    end if;
  end if;
  if p_case > 1 and
    (select count(*) from public.guild_expeditions where user_id = '72222222-2222-4222-8222-222222222222' and claimed_at is null) <> 1 then
    raise exception 'Concurrent starts must create exactly one expedition';
  end if;
  perform dblink_disconnect('exp_a');
  perform dblink_disconnect('exp_b');
  perform dblink_disconnect('exp_blocker');
end;
$concurrency$;
select public.expedition_test_concurrency(1);
select public.expedition_test_concurrency(2);
-- Remove only the unclaimed test start so distinct concurrent starts can race.
delete from public.guild_expeditions where user_id = '72222222-2222-4222-8222-222222222222' and claimed_at is null;
select public.expedition_test_concurrency(3);
drop function public.expedition_test_concurrency(integer);

update public.guild_expedition_rewards set weight = case when reward_id <= 3 then 8 else 3 end;
\ir ../schema.sql

do $item_accounting$
declare v_e record; v_item jsonb; v_owned jsonb;
begin
  for v_e in
    select e.*, r.gear from public.guild_expeditions e
    join public.guild_expedition_rewards r using (reward_id)
    where e.claimed_at is not null
  loop
    v_item := v_e.claim_response -> 'item';
    if v_e.gear is null then
      if coalesce(v_item, 'null'::jsonb) <> 'null'::jsonb or exists (
        select 1 from public.item_issuance_receipts
        where source_kind = 'guild_expedition' and source_ref = v_e.id::text
      ) then raise exception 'Gold-only expedition minted an item'; end if;
    else
      if v_item is null or v_item = 'null'::jsonb or
        not public.item_is_ordinary_gear(v_item -> 'gear') or
        v_item -> 'gear' is distinct from v_e.gear or
        v_item ->> 'owner_id' is distinct from v_e.user_id::text or
        v_item ->> 'custody_state' is distinct from 'owned' or
        v_item ->> 'item_id' is distinct from md5('guild-expedition-item:' || v_e.id::text)::uuid::text or
        (select count(*) from public.item_issuance_receipts
          where source_kind = 'guild_expedition' and source_ref = v_e.id::text
            and item_id = (v_item ->> 'item_id')::uuid
            and issued_owner_id = v_e.user_id and gear = v_e.gear) <> 1 then
        raise exception 'Item must match catalog, allowlist, caller and immutable receipt';
      end if;
      perform set_config('request.jwt.claim.sub', v_e.user_id::text, true);
      set local role authenticated;
      v_owned := public.item_get_owned();
      if not v_owned @> jsonb_build_array(v_item) or
        not (public.guild_expedition_get_owned() -> 'expeditions') @> jsonb_build_array(v_e.claim_response) or
        public.guild_expedition_claim(v_e.id) is distinct from v_e.claim_response then
        raise exception 'Own reads or repeated claim lost the item';
      end if;
      perform set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
      if public.item_get_owned() @> jsonb_build_array(v_item) then
        raise exception 'Another account can see expedition item';
      end if;
      perform public.expedition_test_reject(format('select public.guild_expedition_claim(%L)', v_e.id),
        'P0001', 'Expedition not found.');
      reset role;
    end if;
  end loop;
  if (select count(*) from public.item_issuance_receipts where source_kind = 'guild_expedition') <> 4 or
    (select count(*) from public.player_items where owner_id in (
      '72222222-2222-4222-8222-222222222222', '73333333-3333-4333-8333-333333333333')) <> 4 then
    raise exception 'Expected exactly four items across deterministic weapon and armor outcomes';
  end if;
end
$item_accounting$;

do $accounting$
declare v_e record; v_count integer; v_sum bigint; v_balance bigint;
begin
  for v_e in
    select e.*, r.gold, f.user_id as receipt_owner, f.currency, f.amount, f.source_kind, f.source_ref,
      f.claimed_transaction_id, t.actor_id, t.request_id as funding_request, t.kind, t.payload, t.result
    from public.guild_expeditions e
    join public.guild_expedition_rewards r on r.reward_id = e.reward_id
    join public.wallet_funding_receipts f on f.id = e.receipt_id
    join public.wallet_transactions t on t.id = f.claimed_transaction_id
    where e.claimed_at is not null
  loop
    if v_e.gold not in (15,20,25) or v_e.amount <> v_e.gold or v_e.receipt_owner <> v_e.user_id or
      v_e.currency <> 'gold' or v_e.source_kind <> 'guild_expedition' or v_e.source_ref <> v_e.id::text or
      v_e.actor_id <> v_e.user_id or v_e.funding_request <> v_e.receipt_id or v_e.kind <> 'funding' or
      (v_e.payload ->> 'amount')::bigint <> v_e.gold or (v_e.result ->> 'amount')::bigint <> v_e.gold or
      (v_e.claim_response ->> 'gold')::bigint <> v_e.gold then
      raise exception 'Reward, expedition, receipt and transaction disagree';
    end if;
    select count(*), sum(amount) into v_count, v_sum from public.wallet_ledger_entries
    where transaction_id = v_e.claimed_transaction_id;
    if v_count <> 2 or v_sum <> 0 or not exists (
      select 1 from public.wallet_ledger_entries where transaction_id = v_e.claimed_transaction_id
        and account_type = 'player' and user_id = v_e.user_id and amount = v_e.gold
    ) then raise exception 'Expedition ledger does not balance'; end if;
  end loop;
  if (select count(*) from public.guild_expeditions where claimed_at is not null) <> 5 or
    (select count(*) from public.wallet_funding_receipts where source_kind = 'guild_expedition') <> 5 then
    raise exception 'Missing or duplicate expedition funding';
  end if;
  for v_e in select distinct user_id from public.guild_expeditions loop
    select coalesce(sum(amount),0) into v_sum from public.wallet_funding_receipts
    where user_id = v_e.user_id and source_kind = 'guild_expedition';
    select coalesce(max(balance),0) into v_balance from public.wallet_balances
    where user_id = v_e.user_id and currency = 'gold';
    if v_balance <> v_sum then raise exception 'Balance differs from receipts'; end if;
  end loop;
end
$accounting$;
drop function public.expedition_test_reject(text,text,text);
reset statement_timeout;
reset lock_timeout;
