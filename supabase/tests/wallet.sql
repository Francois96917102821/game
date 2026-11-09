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
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to public;

\ir ../schema.sql
\ir ../schema.sql

insert into auth.users (id)
values
  ('51111111-1111-4111-8111-111111111111'),
  ('52222222-2222-4222-8222-222222222222'),
  ('53333333-3333-4333-8333-333333333333'),
  ('54444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555'),
  ('56666666-6666-4666-8666-666666666666'),
  ('57777777-7777-4777-8777-777777777777'),
  ('58888888-8888-4888-8888-888888888888')
on conflict (id) do nothing;

set role service_role;
do $funding_fixtures$
declare
  v_first uuid;
  v_retry uuid;
  v_error text;
begin
  v_first := public.wallet_register_funding_receipt(
    '51111111-1111-4111-8111-111111111111', 'gold', 307, 'test_reward', 'gold-main'
  );
  v_retry := public.wallet_register_funding_receipt(
    '51111111-1111-4111-8111-111111111111', 'gold', 307, 'test_reward', 'gold-main'
  );
  if v_first <> v_retry then
    raise exception 'Repeated trusted receipt registration must return the same receipt.';
  end if;
  perform public.wallet_register_funding_receipt(
    '51111111-1111-4111-8111-111111111111', 'shard', 103, 'test_reward', 'shard-main'
  );
  perform public.wallet_register_funding_receipt(
    '54444444-4444-4444-8444-444444444444', 'gold', 100, 'test_reward', 'gold-rollback'
  );
  perform public.wallet_register_funding_receipt(
    '56666666-6666-4666-8666-666666666666', 'gold', 100, 'test_reward', 'gold-concurrent'
  );

  begin
    perform public.wallet_register_funding_receipt(
      '52222222-2222-4222-8222-222222222222', 'gold', 307, 'test_reward', 'gold-main'
    );
    raise exception using errcode = 'ZX001', message = 'Conflicting source was accepted.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Источник награды уже зарегистрирован с другими параметрами.' then
        raise exception 'Unexpected duplicate-source rejection: %', v_error;
      end if;
  end;
end
$funding_fixtures$;
reset role;

insert into public.wallet_balances (user_id, currency, balance)
values ('55555555-5555-4555-8555-555555555555', 'gold', 1000000000000)
on conflict (user_id, currency) do update set balance = excluded.balance;

create or replace function public.wallet_test_fail_ledger_insert()
returns trigger
language plpgsql
as $$
begin
  if new.account_type = 'player' and
    new.user_id = '52222222-2222-4222-8222-222222222222' and new.amount = 90 and exists (
      select 1 from public.wallet_transactions
      where id = new.transaction_id
        and actor_id = '54444444-4444-4444-8444-444444444444'
    ) then
    raise exception 'Injected wallet journal failure.';
  end if;
  return new;
end;
$$;

create trigger wallet_test_fail_ledger_insert
  before insert on public.wallet_ledger_entries
  for each row execute function public.wallet_test_fail_ledger_insert();

do $wallet_tests$
declare
  v_owner constant uuid := '51111111-1111-4111-8111-111111111111';
  v_recipient constant uuid := '52222222-2222-4222-8222-222222222222';
  v_stranger constant uuid := '53333333-3333-4333-8333-333333333333';
  v_rollback_sender constant uuid := '54444444-4444-4444-8444-444444444444';
  v_overflow_recipient constant uuid := '55555555-5555-4555-8555-555555555555';
  v_concurrent_sender constant uuid := '56666666-6666-4666-8666-666666666666';
  v_result jsonb;
  v_repeat jsonb;
  v_balances jsonb;
  v_receipts jsonb;
  v_transaction_id uuid;
  v_entry_count integer;
  v_entry_total bigint;
  v_balance_before bigint;
  v_balance_after bigint;
  v_error text;
begin
  if has_function_privilege('anon', 'public.wallet_get_balances()', 'execute') or
    has_function_privilege('anon', 'public.wallet_transfer(text,uuid,bigint,uuid)', 'execute') or
    has_function_privilege('anon', 'public.wallet_claim_funding_receipts()', 'execute') or
    has_function_privilege(
      'authenticated',
      'public.wallet_register_funding_receipt(uuid,text,bigint,text,text)',
      'execute'
    ) or
    not has_function_privilege(
      'service_role',
      'public.wallet_register_funding_receipt(uuid,text,bigint,text,text)',
      'execute'
    ) then
    raise exception 'Wallet RPC privileges are not restricted to their intended roles.';
  end if;
  if has_table_privilege('authenticated', 'public.wallet_balances', 'select') or
    has_table_privilege('authenticated', 'public.wallet_ledger_entries', 'insert') or
    has_table_privilege('authenticated', 'public.wallet_funding_receipts', 'select') or
    has_table_privilege('service_role', 'public.wallet_funding_receipts', 'insert') then
    raise exception 'Wallet tables must only be changed through protected RPCs.';
  end if;
  if exists (
    select 1
    from pg_proc
    where oid = 'public.wallet_transfer(text,uuid,bigint,uuid)'::regprocedure
      and 'p_sender_id' = any(proargnames)
  ) then
    raise exception 'Clients must not be able to choose the transfer sender.';
  end if;
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'wallet_get_balances', 'wallet_transfer',
        'wallet_claim_funding_receipts', 'wallet_register_funding_receipt'
      )
      and (
        not prosecdef or
        coalesce(array_to_string(proconfig, ','), '') not like '%search_path=%'
      )
  ) then
    raise exception 'Wallet RPCs must be SECURITY DEFINER with a fixed search_path.';
  end if;

  perform set_config('request.jwt.claim.sub', v_stranger::text, true);
  v_receipts := public.wallet_claim_funding_receipts();
  v_balances := public.wallet_get_balances();
  if jsonb_array_length(v_receipts -> 'claimed_receipts') <> 0 or
    v_balances <> '{"gold":0,"shard":0}'::jsonb then
    raise exception 'A different user must not claim or read another player''s funding.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_receipts := public.wallet_claim_funding_receipts();
  v_balances := v_receipts -> 'balances';
  if jsonb_array_length(v_receipts -> 'claimed_receipts') <> 2 or
    (v_balances ->> 'gold')::bigint <> 307 or
    (v_balances ->> 'shard')::bigint <> 103 then
    raise exception 'Only trusted receipts should fund the owner''s wallet.';
  end if;
  v_receipts := public.wallet_claim_funding_receipts();
  if jsonb_array_length(v_receipts -> 'claimed_receipts') <> 0 or
    (v_receipts -> 'balances' ->> 'gold')::bigint <> 307 then
    raise exception 'Claim retries must not credit a receipt twice.';
  end if;

  v_result := public.wallet_transfer(
    'gold', v_recipient, 107, 'a1111111-1111-4111-8111-111111111111'
  );
  if (v_result ->> 'fee')::bigint <> 10 or
    (v_result ->> 'received')::bigint <> 97 or
    (v_result ->> 'balance')::bigint <> 200 then
    raise exception 'Gold fee or transfer balance is incorrect.';
  end if;
  v_repeat := public.wallet_transfer(
    'gold', v_recipient, 107, 'a1111111-1111-4111-8111-111111111111'
  );
  if v_repeat <> v_result then
    raise exception 'A retry must return the original transfer result.';
  end if;
  v_transaction_id := (v_result ->> 'transaction_id')::uuid;
  select count(*), sum(amount) into v_entry_count, v_entry_total
  from public.wallet_ledger_entries where transaction_id = v_transaction_id;
  if v_entry_count <> 3 or v_entry_total <> 0 or not exists (
    select 1 from public.wallet_ledger_entries
    where transaction_id = v_transaction_id and account_type = 'treasury' and amount = 10
  ) then
    raise exception 'Gold transfer journal must balance and record the exact fee.';
  end if;

  begin
    perform public.wallet_transfer(
      'gold', v_recipient, 108, 'a1111111-1111-4111-8111-111111111111'
    );
    raise exception using errcode = 'ZX001', message = 'A reused request ID changed its payload.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Ключ перевода уже использован с другими параметрами.' then
        raise exception 'Unexpected idempotency rejection: %', v_error;
      end if;
  end;

  v_result := public.wallet_transfer(
    'gold', v_recipient, 100, 'a8888888-8888-4888-8888-888888888888'
  );
  if (v_result ->> 'fee')::bigint <> 10 or
    (v_result ->> 'received')::bigint <> 90 or
    (v_result ->> 'balance')::bigint <> 100 then
    raise exception 'Second gold transfer fee or balance is incorrect.';
  end if;

  v_result := public.wallet_transfer(
    'shard', v_recipient, 103, 'a2222222-2222-4222-8222-222222222222'
  );
  if (v_result ->> 'fee')::bigint <> 5 or
    (v_result ->> 'received')::bigint <> 98 or
    (v_result ->> 'balance')::bigint <> 0 then
    raise exception 'Shard fee or transfer balance is incorrect.';
  end if;
  v_transaction_id := (v_result ->> 'transaction_id')::uuid;
  select count(*), sum(amount) into v_entry_count, v_entry_total
  from public.wallet_ledger_entries where transaction_id = v_transaction_id;
  if v_entry_count <> 3 or v_entry_total <> 0 or not exists (
    select 1 from public.wallet_ledger_entries
    where transaction_id = v_transaction_id and account_type = 'treasury' and amount = 5
  ) then
    raise exception 'Shard transfer journal must balance and record the exact fee.';
  end if;

  perform set_config('request.jwt.claim.sub', v_recipient::text, true);
  v_result := public.wallet_transfer(
    'gold', v_owner, 100, 'a1111111-1111-4111-8111-111111111111'
  );
  if (v_result ->> 'received')::bigint <> 90 then
    raise exception 'Request IDs must be scoped to their authenticated sender.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform public.wallet_transfer(
      'gold', v_recipient, 99, 'a3333333-3333-4333-8333-333333333333'
    );
    raise exception using errcode = 'ZX001', message = 'A transfer below 100 was accepted.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Перевод должен быть не менее 100 и не более 1 000 000 000 000.' then
        raise exception 'Unexpected minimum transfer rejection: %', v_error;
      end if;
  end;
  begin
    perform public.wallet_transfer(
      'gold', v_recipient, 200, 'a4444444-4444-4444-8444-444444444444'
    );
    raise exception using errcode = 'ZX001', message = 'An insufficiently funded transfer succeeded.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Недостаточно средств.' then
        raise exception 'Unexpected insufficient-funds rejection: %', v_error;
      end if;
  end;
  if exists (
    select 1 from public.wallet_transactions
    where actor_id = v_owner and request_id = 'a4444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'A failed insufficient-funds attempt must not create a transaction.';
  end if;

  perform set_config('request.jwt.claim.sub', v_rollback_sender::text, true);
  v_receipts := public.wallet_claim_funding_receipts();
  v_balance_before := (v_receipts -> 'balances' ->> 'gold')::bigint;
  begin
    perform public.wallet_transfer(
      'gold', v_recipient, 100, 'a5555555-5555-4555-8555-555555555555'
    );
    raise exception using errcode = 'ZX001', message = 'A failed journal write was committed.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Injected wallet journal failure.' then
        raise exception 'Unexpected journal rollback failure: %', v_error;
      end if;
  end;
  select balance into v_balance_after from public.wallet_balances
  where user_id = v_rollback_sender and currency = 'gold';
  if v_balance_after <> v_balance_before or exists (
    select 1 from public.wallet_transactions
    where actor_id = v_rollback_sender
      and request_id = 'a5555555-5555-4555-8555-555555555555'
  ) or exists (
    select 1 from public.wallet_ledger_entries
    where user_id = v_rollback_sender
      and transaction_id in (
        select id from public.wallet_transactions
        where actor_id = v_rollback_sender
          and request_id = 'a5555555-5555-4555-8555-555555555555'
      )
  ) then
    raise exception 'A failed transfer must roll back balance, transaction, and ledger changes.';
  end if;

  begin
    perform public.wallet_transfer(
      'gold', v_overflow_recipient, 100, 'a9999999-9999-4999-8999-999999999999'
    );
    raise exception using errcode = 'ZX001', message = 'A recipient balance overflow was accepted.';
  exception
    when sqlstate 'ZX001' then
      raise;
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'Баланс получателя достиг предела.' then
        raise exception 'Unexpected overflow rejection: %', v_error;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_concurrent_sender::text, true);
  v_receipts := public.wallet_claim_funding_receipts();
  if (v_receipts -> 'balances' ->> 'gold')::bigint <> 100 then
    raise exception 'Concurrency fixture funding failed.';
  end if;
end
$wallet_tests$;

do $concurrent_double_spend$
declare
  v_sender constant uuid := '56666666-6666-4666-8666-666666666666';
  v_recipient_a constant uuid := '57777777-7777-4777-8777-777777777777';
  v_recipient_b constant uuid := '58888888-8888-4888-8888-888888888888';
  v_connection text;
  v_auth_connection text;
  v_result_a text;
  v_result_b text;
  v_successes integer;
  v_sender_balance bigint;
  v_total_received bigint;
  v_wait_until timestamptz;
begin
  v_connection := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=local-test-only',
    current_setting('port'), current_database()
  );
  v_auth_connection := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=local-test-only ' ||
      'options=''-c role=authenticated -c request.jwt.claim.sub=%s''',
    current_setting('port'), current_database(), v_sender
  );
  perform dblink_connect('wallet_blocker', v_connection);
  perform dblink_connect('wallet_a', v_auth_connection);
  perform dblink_connect('wallet_b', v_auth_connection);
  perform dblink_exec('wallet_blocker', 'begin');
  perform 1
  from dblink(
    'wallet_blocker',
    format(
      'select user_id from public.wallet_balances where user_id = %L::uuid ' ||
        'and currency = ''gold'' for update',
      v_sender
    )
  ) as locked(user_id uuid);

  perform dblink_send_query(
    'wallet_a',
    format(
      'select public.wallet_transfer(''gold'', %L::uuid, 100, ' ||
        '''a6666666-6666-4666-8666-666666666666''::uuid)::text',
      v_recipient_a
    )
  );
  perform dblink_send_query(
    'wallet_b',
    format(
      'select public.wallet_transfer(''gold'', %L::uuid, 100, ' ||
        '''a7777777-7777-4777-8777-777777777777''::uuid)::text',
      v_recipient_b
    )
  );

  v_wait_until := clock_timestamp() + interval '10 seconds';
  while dblink_is_busy('wallet_a') = 0 or dblink_is_busy('wallet_b') = 0 loop
    if clock_timestamp() >= v_wait_until then
      raise exception 'Concurrent transfer requests did not reach the locked wallet.';
    end if;
    perform pg_sleep(0.05);
  end loop;
  perform dblink_exec('wallet_blocker', 'commit');

  select value into v_result_a
  from dblink_get_result('wallet_a', false) as result(value text);
  select value into v_result_b
  from dblink_get_result('wallet_b', false) as result(value text);
  perform dblink_disconnect('wallet_a');
  perform dblink_disconnect('wallet_b');
  perform dblink_disconnect('wallet_blocker');

  v_successes := (case when v_result_a is not null then 1 else 0 end) +
    (case when v_result_b is not null then 1 else 0 end);
  if v_successes <> 1 then
    raise exception 'Exactly one of two concurrent spends must succeed; got % successes.', v_successes;
  end if;
  select balance into v_sender_balance
  from public.wallet_balances where user_id = v_sender and currency = 'gold';
  select coalesce(sum(balance), 0) into v_total_received
  from public.wallet_balances
  where user_id in (v_recipient_a, v_recipient_b) and currency = 'gold';
  if v_sender_balance <> 0 or v_total_received <> 90 then
    raise exception 'Concurrent spending must debit once and credit exactly one net amount.';
  end if;
end
$concurrent_double_spend$;

drop trigger wallet_test_fail_ledger_insert on public.wallet_ledger_entries;
drop function public.wallet_test_fail_ledger_insert();
