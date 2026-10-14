\set ON_ERROR_STOP on

-- The earlier CI stages bootstrap auth/roles and dblink in the disposable DB.
\ir ../schema.sql
\ir ../schema.sql
set statement_timeout = '30s';
set lock_timeout = '10s';
insert into auth.users(id) values
  ('81111111-1111-4111-8111-111111111111'),
  ('82222222-2222-4222-8222-222222222222'),
  ('83333333-3333-4333-8333-333333333333'),
  ('84444444-4444-4444-8444-444444444444'),
  ('85555555-5555-4555-8555-555555555555'),
  ('86666666-6666-4666-8666-666666666666')
on conflict do nothing;

create function public.auction_test_reject(p_sql text, p_state text, p_message text default null)
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
  foreach v_role in array array['anon','authenticated','service_role'] loop
    foreach v_table in array array['auction_listings','auction_request_receipts'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role, 'public.' || v_table, v_privilege) then
          raise exception 'Unexpected % % grant to %', v_table, v_privilege, v_role;
        end if;
      end loop;
      if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) or
        exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table) then
        raise exception 'Auction storage must have deny-default RLS';
      end if;
      execute format('set local role %I', v_role);
      perform public.auction_test_reject('select * from public.' || v_table, '42501');
      perform public.auction_test_reject('insert into public.' || v_table || ' default values', '42501');
      perform public.auction_test_reject('delete from public.' || v_table, '42501');
      perform public.auction_test_reject('update public.' || v_table || ' set ' ||
        case v_table when 'auction_listings' then 'price = 1' else 'payload = ''{}''::jsonb' end, '42501');
      reset role;
    end loop;
    foreach v_rpc in array array['auction_list_item(uuid,uuid,bigint)','auction_cancel(uuid,uuid)',
      'auction_buy(uuid,uuid,bigint)','auction_browse(uuid,integer)','auction_get_mine(uuid,integer)'] loop
      if has_function_privilege(v_role, 'public.' || v_rpc, 'EXECUTE') <> (v_role = 'authenticated') then
        raise exception 'Unexpected auction RPC grant % to %', v_rpc, v_role;
      end if;
      if exists (select 1 from pg_proc where oid = ('public.' || v_rpc)::regprocedure
        and (not prosecdef or not proconfig @> array['search_path=""','row_security=off'])) then
        raise exception 'Unpinned auction definer %', v_rpc;
      end if;
    end loop;
    if has_function_privilege(v_role, 'public.auction_fee(bigint)', 'EXECUTE') or
      has_function_privilege(v_role, 'public.auction_request_begin(uuid,jsonb)', 'EXECUTE') then
      raise exception 'Internal auction helper exposed';
    end if;
    execute format('set local role %I', v_role);
    if v_role <> 'authenticated' then
      perform public.auction_test_reject('select public.auction_list_item(null,null,null)', '42501');
      perform public.auction_test_reject('select public.auction_cancel(null,null)', '42501');
      perform public.auction_test_reject('select public.auction_buy(null,null,null)', '42501');
      perform public.auction_test_reject('select public.auction_browse()', '42501');
      perform public.auction_test_reject('select public.auction_get_mine()', '42501');
    end if;
    if v_role <> 'service_role' then
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.auction_test_reject('select public.item_register_issuance(null,null,null,null,null)', '42501');
      perform public.auction_test_reject('select public.wallet_register_funding_receipt(null,null,null,null,null)', '42501');
    end if;
    reset role;
  end loop;
end
$privileges$;

set role service_role;
do $fixtures$
declare v_i integer; v_owner uuid;
begin
  for v_i in 1..30 loop
    v_owner := case when v_i >= 20 then '85555555-5555-4555-8555-555555555555'::uuid
      when v_i = 19 then '84444444-4444-4444-8444-444444444444'::uuid
      else '81111111-1111-4111-8111-111111111111'::uuid end;
    perform public.item_register_issuance(
      ('d0000000-0000-4000-8000-' || lpad(v_i::text,12,'0'))::uuid,
      v_owner, '{"id":"gear-1","type":"weapon","name":"Клинок каменного эха","bonus":3}',
      'auction_test', 'item-' || v_i);
  end loop;
  perform public.wallet_register_funding_receipt('82222222-2222-4222-8222-222222222222',
    'gold', 10000, 'auction_test', 'buyer-a');
  perform public.wallet_register_funding_receipt('83333333-3333-4333-8333-333333333333',
    'gold', 10000, 'auction_test', 'buyer-b');
  perform public.wallet_register_funding_receipt('84444444-4444-4444-8444-444444444444',
    'gold', 1000000000000, 'auction_test', 'overflow');
end
$fixtures$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',false);
select public.wallet_claim_funding_receipts();
select set_config('request.jwt.claim.sub','83333333-3333-4333-8333-333333333333',false);
select public.wallet_claim_funding_receipts();
select set_config('request.jwt.claim.sub','84444444-4444-4444-8444-444444444444',false);
select public.wallet_claim_funding_receipts();

do $functional$
declare
  v_seller uuid := '81111111-1111-4111-8111-111111111111';
  v_buyer uuid := '82222222-2222-4222-8222-222222222222';
  v_first jsonb; v_buy jsonb; v_cancel jsonb; v_id uuid; v_i integer; v_rpc text;
begin
  perform set_config('request.jwt.claim.sub','',true);
  foreach v_rpc in array array[
    'auction_list_item(null,null,null)', 'auction_buy(null,null,null)', 'auction_cancel(null,null)',
    'auction_browse()', 'auction_get_mine()'
  ] loop
    perform public.auction_test_reject('select public.' || v_rpc, 'P0001', 'Authentication required.');
  end loop;
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  perform public.auction_test_reject(
    $$select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000001',107)$$,
    'P0001','Item is not owned ordinary gear available for listing.');
  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  perform public.auction_test_reject(
    $$select public.auction_list_item(null,'d0000000-0000-4000-8000-000000000001',107)$$,
    'P0001','Request UUID required.');
  foreach v_i in array array[0,-1,1000001] loop
    perform public.auction_test_reject(format(
      'select public.auction_list_item(gen_random_uuid(),''d0000000-0000-4000-8000-000000000001'',%s)',v_i),
      'P0001','Invalid auction item or price.');
  end loop;
  v_first := public.auction_list_item('e0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',107);
  v_id := (v_first ->> 'id')::uuid;
  if public.auction_list_item('e0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000001',107) <> v_first or
    (v_first ->> 'expires_at')::timestamptz - (v_first ->> 'created_at')::timestamptz <> interval '48 hours' or
    abs(extract(epoch from clock_timestamp() - (v_first ->> 'created_at')::timestamptz)) > 5 then
    raise exception 'List retry/server duration mismatch';
  end if;
  perform public.auction_test_reject(
    $$select public.auction_list_item('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',108)$$,
    'P0001','Request UUID was already used with a different payload.');
  perform public.auction_test_reject(format('select public.auction_cancel(''e0000000-0000-4000-8000-000000000001'',%L)',v_id),
    'P0001','Request UUID was already used with a different payload.');
  perform public.auction_test_reject(format('select public.auction_buy(gen_random_uuid(),%L,107)',v_id),
    'P0001','Cannot buy your own listing.');
  perform public.auction_test_reject(
    $$select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000001',107)$$,
    'P0001','Item is not owned ordinary gear available for listing.');
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  if public.auction_get_mine() -> 'listings' <> '[]'::jsonb then raise exception 'Cross-seller visibility'; end if;
  perform public.auction_test_reject(format('select public.auction_cancel(gen_random_uuid(),%L)',v_id),
    'P0001','Listing unavailable to seller.');
  perform public.auction_test_reject(format('select public.auction_buy(gen_random_uuid(),%L,108)',v_id),
    'P0001','Listing price does not match.');
  perform public.auction_test_reject(format('select public.auction_buy(gen_random_uuid(),%L,null)',v_id),
    'P0001','Listing price does not match.');
  -- Missing server balance, irrespective of any local save.
  perform set_config('request.jwt.claim.sub','86666666-6666-4666-8666-666666666666',true);
  perform public.auction_test_reject(format(
    'select public.auction_buy(''e0000000-0000-4000-8000-000000000099'',%L,107)',v_id),
    'P0001','Insufficient gold.');
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  v_buy := public.auction_buy('e0000000-0000-4000-8000-000000000002',v_id,107);
  if public.auction_buy('e0000000-0000-4000-8000-000000000002',v_id,107) <> v_buy or
    v_buy ->> 'fee' <> '5' or v_buy ->> 'received' <> '102' or v_buy ->> 'balance' <> '9893' then
    raise exception 'Purchase retry or fee floor mismatch';
  end if;
  perform public.auction_test_reject(format(
    'select public.auction_buy(''e0000000-0000-4000-8000-000000000002'',%L,106)',v_id),
    'P0001','Request UUID was already used with a different payload.');
  perform set_config('request.jwt.claim.sub',v_seller::text,true);
  if public.auction_list_item('e0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000001',107) <> v_first then
    raise exception 'Historical list receipt changed after sale';
  end if;
  perform public.auction_test_reject(format('select public.auction_cancel(gen_random_uuid(),%L)',v_id),
    'P0001','Listing is not active.');
  v_id := (public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000002',1) ->> 'id')::uuid;
  v_cancel := public.auction_cancel('e0000000-0000-4000-8000-000000000003',v_id);
  if public.auction_cancel('e0000000-0000-4000-8000-000000000003',v_id) <> v_cancel then
    raise exception 'Cancel retry mismatch';
  end if;
  v_id := (public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000002',1) ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub',v_buyer::text,true);
  v_buy := public.auction_buy(gen_random_uuid(),v_id,1);
  if v_buy ->> 'fee' <> '0' or v_buy ->> 'received' <> '1' then raise exception 'Zero fee purchase failed'; end if;
  perform public.auction_test_reject('select public.auction_browse(null,0)','P0001','Invalid page size.');
  perform public.auction_test_reject('select public.auction_get_mine(null,101)','P0001','Invalid page size.');
end
$functional$;
reset role;

do $rollback_insufficient$
begin
  if exists (select 1 from public.wallet_balances where user_id = '86666666-6666-4666-8666-666666666666') or
    exists (select 1 from public.wallet_transactions where request_id = 'e0000000-0000-4000-8000-000000000099') or
    exists (select 1 from public.auction_request_receipts where request_id = 'e0000000-0000-4000-8000-000000000099') then
    raise exception 'Insufficient funds left balance/transaction/receipt changes';
  end if;
end
$rollback_insufficient$;

-- Administrator-only corrupt fixture proves defensive ordinary-gear check.
begin;
alter table public.item_issuance_receipts drop constraint item_issuance_receipts_gear_check;
update public.item_issuance_receipts set gear = gear || '{"bound":true}'
where item_id = 'd0000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
select public.auction_test_reject(
  $$select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000003',100)$$,
  'P0001','Item is not owned ordinary gear available for listing.');
rollback;

-- Public tables remain invisible even under an accidental read grant.
begin;
grant select on public.auction_listings, public.auction_request_receipts to authenticated;
set local role authenticated;
do $rls$
begin
  if exists (select 1 from public.auction_listings) or exists (select 1 from public.auction_request_receipts) then
    raise exception 'RLS exposed auction storage';
  end if;
end
$rls$;
rollback;

set role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',false);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000003',100);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000004',107);
reset role;
update public.auction_listings set created_at = created_at - interval '49 hours',
  expires_at = expires_at - interval '49 hours' where item_id = 'd0000000-0000-4000-8000-000000000003';

do $expired_and_rollback$
declare v_id uuid;
begin
  select id into v_id from public.auction_listings where item_id = 'd0000000-0000-4000-8000-000000000003';
  perform set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
  set local role authenticated;
  perform public.auction_test_reject(format('select public.auction_buy(gen_random_uuid(),%L,100)',v_id),
    'P0001','Listing expired.');
  if exists (select 1 from jsonb_array_elements(public.auction_browse() -> 'listings') l where l ->> 'id' = v_id::text) then
    raise exception 'Browse returned expired listing';
  end if;
  perform set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
  if not exists (select 1 from jsonb_array_elements(public.auction_get_mine() -> 'listings') l
    where l ->> 'id' = v_id::text and l ->> 'status' = 'expired') then
    raise exception 'Expired escrow cannot be discovered by seller';
  end if;
  perform public.auction_cancel(gen_random_uuid(),v_id);
  reset role;
end
$expired_and_rollback$;

do $insufficient_rollback$
declare v_id uuid; v_before jsonb; v_after jsonb;
begin
  select id into v_id from public.auction_listings where item_id = 'd0000000-0000-4000-8000-000000000004';
  select jsonb_build_object(
    'balances', (select jsonb_agg(to_jsonb(b) order by user_id,currency) from public.wallet_balances b),
    'listing', (select to_jsonb(l) from public.auction_listings l where id = v_id),
    'item', (select to_jsonb(i) from public.player_items i where item_id = 'd0000000-0000-4000-8000-000000000004'),
    'transactions', (select count(*) from public.wallet_transactions),
    'ledger', (select count(*) from public.wallet_ledger_entries),
    'receipts', (select count(*) from public.auction_request_receipts)
  ) into v_before;
  perform set_config('request.jwt.claim.sub','86666666-6666-4666-8666-666666666666',true);
  set local role authenticated;
  perform public.auction_test_reject(format(
    'select public.auction_buy(''e0000000-0000-4000-8000-000000000097'',%L,107)',v_id),
    'P0001','Insufficient gold.');
  reset role;
  select jsonb_build_object(
    'balances', (select jsonb_agg(to_jsonb(b) order by user_id,currency) from public.wallet_balances b),
    'listing', (select to_jsonb(l) from public.auction_listings l where id = v_id),
    'item', (select to_jsonb(i) from public.player_items i where item_id = 'd0000000-0000-4000-8000-000000000004'),
    'transactions', (select count(*) from public.wallet_transactions),
    'ledger', (select count(*) from public.wallet_ledger_entries),
    'receipts', (select count(*) from public.auction_request_receipts)
  ) into v_after;
  if v_after is distinct from v_before then raise exception 'Insufficient gold did not fully roll back'; end if;
end
$insufficient_rollback$;

-- Fail the final receipt write after balances, ledger, custody and listing changed.
create function public.auction_test_fail_receipt()
returns trigger language plpgsql as $$
begin
  if new.request_id = 'e0000000-0000-4000-8000-000000000098' then
    raise exception 'Injected auction receipt failure.';
  end if;
  return new;
end;
$$;
create trigger auction_test_fail_receipt before insert on public.auction_request_receipts
for each row execute function public.auction_test_fail_receipt();
do $rollback$
declare v_id uuid; v_before jsonb; v_after jsonb;
begin
  select id into v_id from public.auction_listings where item_id = 'd0000000-0000-4000-8000-000000000004';
  select jsonb_agg(to_jsonb(b) order by user_id,currency) into v_before from public.wallet_balances b;
  perform set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
  set local role authenticated;
  perform public.auction_test_reject(format(
    'select public.auction_buy(''e0000000-0000-4000-8000-000000000098'',%L,107)',v_id),
    'P0001','Injected auction receipt failure.');
  reset role;
  select jsonb_agg(to_jsonb(b) order by user_id,currency) into v_after from public.wallet_balances b;
  if v_after <> v_before or exists (
    select 1 from public.wallet_transactions where request_id = 'e0000000-0000-4000-8000-000000000098'
  ) or not exists (
    select 1 from public.auction_listings l join public.player_items i using(item_id)
    where l.id = v_id and l.status = 'active' and l.transaction_id is null
      and i.owner_id = l.seller_id and i.custody_state = 'auction_escrow'
  ) then raise exception 'Final write failure did not roll back the whole sale'; end if;
end
$rollback$;
drop trigger auction_test_fail_receipt on public.auction_request_receipts;
drop function public.auction_test_fail_receipt();

do $limits_and_browse$
declare v_i integer; v_page jsonb; v_next jsonb; v_id uuid;
begin
  perform set_config('request.jwt.claim.sub','85555555-5555-4555-8555-555555555555',true);
  set local role authenticated;
  for v_i in 20..28 loop
    perform public.auction_list_item(gen_random_uuid(),
      ('d0000000-0000-4000-8000-' || lpad(v_i::text,12,'0'))::uuid,1000000);
  end loop;
  v_page := public.auction_get_mine(null,2) -> 'listings';
  v_next := public.auction_get_mine((v_page -> 1 ->> 'id')::uuid,2) -> 'listings';
  if jsonb_array_length(v_page) <> 2 or jsonb_array_length(v_next) <> 2 or
    v_next -> 0 ->> 'id' <= v_page -> 1 ->> 'id' then raise exception 'Own keyset pagination failed'; end if;
  v_page := public.auction_browse(null,2) -> 'listings';
  v_next := public.auction_browse((v_page -> 1 ->> 'id')::uuid,2) -> 'listings';
  if jsonb_array_length(v_page) <> 2 or jsonb_array_length(v_next) <> 2 or
    v_next -> 0 ->> 'id' <= v_page -> 1 ->> 'id' or exists (
      select 1 from jsonb_array_elements(v_page || v_next) l
      where (l - array['id','item_id','gear','price','expires_at']) <> '{}'::jsonb
    ) then raise exception 'Browse pagination or public payload failed'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub','84444444-4444-4444-8444-444444444444',true);
  set local role authenticated;
  v_id := (public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000019',100) ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
  perform public.auction_test_reject(format('select public.auction_buy(gen_random_uuid(),%L,100)',v_id),
    'P0001','Seller balance limit reached.');
  reset role;
end
$limits_and_browse$;

-- Precommit listings before remote connections; one top-level SELECT per case.
set role authenticated;
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',false);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000005',107);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000006',107);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000007',107);
select public.auction_list_item(gen_random_uuid(),'d0000000-0000-4000-8000-000000000008',107);
reset role;

create function public.auction_test_concurrency(p_case integer)
returns void language plpgsql as $concurrency$
declare
  v_connection text := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=local-test-only',
    current_setting('port'), current_database());
  v_seller uuid := '81111111-1111-4111-8111-111111111111';
  v_buyer uuid := '82222222-2222-4222-8222-222222222222';
  v_other uuid := '83333333-3333-4333-8333-333333333333';
  v_item uuid := ('d0000000-0000-4000-8000-' || lpad((p_case + 4)::text,12,'0'))::uuid;
  v_listing uuid; v_query_a text; v_query_b text; v_a text; v_b text; v_error text;
  v_deadline timestamptz; v_before bigint; v_after bigint; v_sales integer; v_fee bigint;
begin
  if p_case <= 4 then
    select id into strict v_listing from public.auction_listings where item_id = v_item and status = 'active';
    v_query_a := format('select public.auction_buy(%L,%L,107)::text',
      ('f0000000-0000-4000-8000-' || lpad(p_case::text,12,'0'))::uuid, v_listing);
    v_query_b := case when p_case = 1 then
      format('select public.auction_cancel(gen_random_uuid(),%L)::text',v_listing)
      when p_case = 4 then replace(v_query_a, ',107)', ',108)') else v_query_a end;
    if p_case = 1 then v_other := v_seller; end if;
    if p_case >= 3 then v_other := v_buyer; end if;
  else
    v_buyer := case when p_case = 6 then '85555555-5555-4555-8555-555555555555'::uuid else v_seller end;
    v_other := v_buyer;
    v_item := case when p_case = 6 then 'd0000000-0000-4000-8000-000000000029'::uuid else v_item end;
    v_query_a := format('select public.auction_list_item(gen_random_uuid(),%L,107)::text',v_item);
    v_query_b := case when p_case = 6 then replace(v_query_a,'000000000029','000000000030') else v_query_a end;
  end if;
  select sum(balance) into v_before from public.wallet_balances where currency = 'gold';
  perform dblink_connect('auction_gate',v_connection || ' options=''-c lock_timeout=10s -c statement_timeout=15s''');
  perform dblink_connect('auction_a',v_connection || format(
    ' application_name=auction_test_a options=''-c role=authenticated -c request.jwt.claim.sub=%s -c lock_timeout=10s -c statement_timeout=15s''',v_buyer));
  perform dblink_connect('auction_b',v_connection || format(
    ' application_name=auction_test_b options=''-c role=authenticated -c request.jwt.claim.sub=%s -c lock_timeout=10s -c statement_timeout=15s''',v_other));
  perform dblink_exec('auction_gate','begin');
  -- EXCLUSIVE gates mutations while retaining read access for the coordinator.
  perform dblink_exec('auction_gate','lock table public.auction_listings in exclusive mode');
  perform dblink_send_query('auction_a',v_query_a);
  perform dblink_send_query('auction_b',v_query_b);
  v_deadline := clock_timestamp() + interval '8 seconds';
  while (select count(*) from pg_stat_activity
    where application_name in ('auction_test_a','auction_test_b') and wait_event_type = 'Lock') <> 2 loop
    if clock_timestamp() > v_deadline then raise exception 'Concurrent calls did not reach gate'; end if;
    perform pg_sleep(0.05);
    perform pg_stat_clear_snapshot();
  end loop;
  perform dblink_exec('auction_gate','commit');
  select value into v_a from dblink_get_result('auction_a',false) as result(value text);
  select value into v_b from dblink_get_result('auction_b',false) as result(value text);
  if p_case = 3 then
    if v_a is null or v_b is distinct from v_a then raise exception 'Concurrent purchase retries diverged'; end if;
  else
    if (case when v_a is not null then 1 else 0 end) + (case when v_b is not null then 1 else 0 end) <> 1 then
      raise exception 'Race % must have exactly one winner: %, %',p_case,v_a,v_b;
    end if;
    v_error := dblink_error_message(case when v_a is null then 'auction_a' else 'auction_b' end);
    if position(case when p_case <= 2 then 'Listing is not active.'
      when p_case = 4 then 'Listing price does not match.'
      when p_case = 5 then 'Item is not owned ordinary gear available for listing.'
      else 'Auction listing limit reached' end in v_error) = 0 and not (
        p_case = 4 and position('Request UUID was already used with a different payload.' in v_error) > 0
      ) then raise exception 'Unexpected race % error: %',p_case,v_error; end if;
  end if;
  select sum(balance) into v_after from public.wallet_balances where currency = 'gold';
  select count(*),coalesce(sum(public.auction_fee(price)),0) into v_sales,v_fee
  from public.auction_listings where id = v_listing and status = 'sold';
  if v_after <> v_before - v_fee or (p_case between 2 and 4 and v_sales <> 1) then
    raise exception 'Race duplicated a purchase or violated gold conservation';
  end if;
  if (select count(*) from public.player_items where item_id = v_item) <> 1 or
    (p_case <= 4 and not exists (
      select 1 from public.player_items i join public.auction_listings l using(item_id)
      where l.id = v_listing and i.custody_state = 'owned' and
        i.owner_id = case when l.status = 'sold' then l.buyer_id else l.seller_id end
    )) then raise exception 'Race lost/duplicated item ownership'; end if;
  if p_case = 6 and (select count(*) from public.auction_listings
    where seller_id = v_buyer and status = 'active') <> 10 then
    raise exception 'Concurrent listings bypassed seller limit';
  end if;
  perform dblink_disconnect('auction_a');
  perform dblink_disconnect('auction_b');
  perform dblink_disconnect('auction_gate');
end;
$concurrency$;
select public.auction_test_concurrency(1);
select public.auction_test_concurrency(2);
select public.auction_test_concurrency(3);
select public.auction_test_concurrency(4);
select public.auction_test_concurrency(5);
select public.auction_test_concurrency(6);
drop function public.auction_test_concurrency(integer);

do $expired_slots$
declare v_id uuid; v_item uuid;
begin
  select id into v_id from public.auction_listings
  where seller_id = '85555555-5555-4555-8555-555555555555' and status = 'active' order by id limit 1;
  update public.auction_listings set created_at = created_at - interval '49 hours',
    expires_at = expires_at - interval '49 hours' where id = v_id;
  select item_id into strict v_item from public.player_items
  where owner_id = '85555555-5555-4555-8555-555555555555' and custody_state = 'owned';
  perform set_config('request.jwt.claim.sub','85555555-5555-4555-8555-555555555555',true);
  set local role authenticated;
  perform public.auction_test_reject(format(
    'select public.auction_list_item(gen_random_uuid(),%L,107)',v_item),
    'P0001','Auction listing limit reached; cancel expired listings first.');
  perform public.auction_cancel(gen_random_uuid(),v_id);
  perform public.auction_list_item(gen_random_uuid(),v_item,107);
  reset role;
end
$expired_slots$;

do $accounting$
declare v_sale record; v_balance record; v_total bigint; v_count integer;
begin
  for v_sale in select l.*,t.actor_id,t.request_id,t.kind,t.currency,t.payload,t.result
    from public.auction_listings l join public.wallet_transactions t on t.id = l.transaction_id
    where l.status = 'sold'
  loop
    select count(*),sum(amount) into v_count,v_total from public.wallet_ledger_entries
    where transaction_id = v_sale.transaction_id;
    if v_total <> 0 or v_count <> (case when public.auction_fee(v_sale.price) = 0 then 2 else 3 end) or
      v_sale.kind <> 'auction' or v_sale.currency <> 'gold' or v_sale.actor_id <> v_sale.buyer_id or
      v_sale.payload ->> 'fee_sink' <> 'burn' or not exists (
        select 1 from public.wallet_ledger_entries where transaction_id = v_sale.transaction_id
          and account_type = 'player' and user_id = v_sale.buyer_id and amount = -v_sale.price
      ) or not exists (
        select 1 from public.wallet_ledger_entries where transaction_id = v_sale.transaction_id
          and account_type = 'player' and user_id = v_sale.seller_id
          and amount = v_sale.price - public.auction_fee(v_sale.price)
      ) or (public.auction_fee(v_sale.price) > 0 and not exists (
        select 1 from public.wallet_ledger_entries where transaction_id = v_sale.transaction_id
          and account_type = 'treasury' and user_id is null and amount = public.auction_fee(v_sale.price)
      )) or not exists (
        select 1 from public.auction_request_receipts where user_id = v_sale.buyer_id
          and request_id = v_sale.request_id and response = v_sale.result
      ) then raise exception 'Auction transaction, receipt and balanced burn ledger disagree'; end if;
  end loop;
  if (select count(*) from public.wallet_transactions where kind = 'auction') <>
    (select count(*) from public.auction_listings where status = 'sold') or exists (
      select 1 from public.auction_request_receipts r where r.payload ->> 'rpc' = 'auction_buy'
        and not exists (select 1 from public.wallet_transactions t where t.kind = 'auction'
          and t.actor_id = r.user_id and t.request_id = r.request_id and t.result = r.response)
    ) then raise exception 'Duplicate/orphan auction transaction or buy receipt'; end if;
  for v_balance in select * from public.wallet_balances where user_id::text like '8%' loop
    select coalesce(sum(amount),0) into v_total from public.wallet_ledger_entries
    where user_id = v_balance.user_id and currency = v_balance.currency and account_type = 'player';
    if v_balance.balance <> v_total then raise exception 'Player balance differs from ledger'; end if;
  end loop;
  if exists (
    select 1 from public.auction_listings l join public.player_items i using(item_id)
    where l.status = 'active' and (i.owner_id <> l.seller_id or i.custody_state <> 'auction_escrow')
  ) or exists (
    select 1 from public.player_items i where i.custody_state = 'auction_escrow'
      and not exists (select 1 from public.auction_listings l where l.item_id = i.item_id and l.status = 'active')
  ) then raise exception 'Orphan escrow'; end if;
end
$accounting$;
drop function public.auction_test_reject(text,text,text);
reset statement_timeout;
reset lock_timeout;
