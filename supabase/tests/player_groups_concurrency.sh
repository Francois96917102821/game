#!/usr/bin/env bash
set -euo pipefail

psql_cmd=(psql -X -qAt -v ON_ERROR_STOP=1)
owner_id=77777777-7777-4777-8777-777777777777
partner_a=88888888-8888-4888-8888-888888888888
partner_b=99999999-9999-4999-8999-999999999999
group_id=
invite_log=$(mktemp)
join_log=$(mktemp)
action_log=$(mktemp)

cleanup() {
  if [[ -n "$group_id" ]]; then
    "${psql_cmd[@]}" -c "delete from public.player_groups where id = '$group_id'" >/dev/null 2>&1 || true
  fi
  "${psql_cmd[@]}" -c "delete from auth.users where id in ('$owner_id', '$partner_a', '$partner_b')" >/dev/null 2>&1 || true
  rm -f "$invite_log" "$join_log" "$action_log"
}
trap cleanup EXIT

existing_users=$("${psql_cmd[@]}" -c "
  select count(*) from auth.users
  where id in ('$owner_id', '$partner_a', '$partner_b')
")
if [[ "$existing_users" != "0" ]]; then
  echo "Refusing to reuse pre-existing test user IDs in this database." >&2
  exit 1
fi
"${psql_cmd[@]}" -c "insert into auth.users (id) values ('$owner_id'), ('$partner_a'), ('$partner_b')"

group_result=$("${psql_cmd[@]}" -c "
  begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '$owner_id';
  select (group_state -> 'group' ->> 'id') || '|' || (group_state ->> 'invite_code')
  from (select public.create_player_group('Race owner', 5) as group_state) created;
  commit;
")
IFS='|' read -r group_id invite_code <<<"$group_result"
if [[ -z "$group_id" || -z "$invite_code" ]]; then
  echo "Could not create a group for the concurrent invitation test." >&2
  exit 1
fi

accept_invite() {
  local user_id=$1
  "${psql_cmd[@]}" -c "
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '$user_id';
    select public.accept_player_group_invite('$invite_code', 'Race partner', 5);
    select pg_sleep(2);
    commit;
  "
}

accept_invite "$partner_a" >"$invite_log" 2>&1 &
invite_first_pid=$!
sleep 0.5
set +e
accept_invite "$partner_b" >>"$invite_log" 2>&1 &
invite_second_pid=$!
wait "$invite_first_pid"
invite_first_status=$?
wait "$invite_second_pid"
invite_second_status=$?
set -e
if [[ "$invite_first_status" -eq "$invite_second_status" ]] ||
  ! grep -Fq 'Код приглашения недействителен или истёк.' "$invite_log"; then
  cat "$invite_log" >&2
  echo "Concurrent joins must consume a single-use invitation exactly once." >&2
  exit 1
fi

partner_id=$("${psql_cmd[@]}" -c "
  select user_id from public.player_group_members
  where group_id = '$group_id' and user_id <> '$owner_id'
")
if [[ -z "$partner_id" ]]; then
  echo "The winning invitee was not stored in the group." >&2
  exit 1
fi

"${psql_cmd[@]}" -c "
  update public.player_group_members
  set in_dungeon = true, heartbeat_at = now()
  where group_id = '$group_id';
"
battle_id=$("${psql_cmd[@]}" -c "
  begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '$owner_id';
  select public.start_player_group_battle(
    17, 'Concurrent guard', 'B', 'guardian', 100, 100, 8, 40, 50,
    '{\"hp\":40,\"max_hp\":40,\"potions\":1,\"attack\":25,\"defense\":2,\"focus\":0,\"heavy_multiplier\":2.5}'::jsonb
  ) ->> 'id';
  commit;
")
if [[ -z "$battle_id" ]]; then
  echo "Could not start a battle for the concurrent action test." >&2
  exit 1
fi

join_battle() {
  "${psql_cmd[@]}" -c "
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '$partner_id';
    select public.join_player_group_battle(
      '$battle_id',
      '{\"hp\":30,\"max_hp\":30,\"potions\":1,\"attack\":20,\"defense\":1,\"focus\":0,\"heavy_multiplier\":2.5}'::jsonb
    );
    select pg_sleep(2);
    commit;
  "
}

join_battle >"$join_log" 2>&1 &
join_first_pid=$!
sleep 0.5
set +e
join_battle >>"$join_log" 2>&1
join_second_status=$?
wait "$join_first_pid"
join_first_status=$?
set -e
if [[ "$join_first_status" -ne 0 || "$join_second_status" -ne 0 ]]; then
  cat "$join_log" >&2
  echo "Concurrent retries of the same battle join must both return successfully." >&2
  exit 1
fi

action_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
act() {
  "${psql_cmd[@]}" -c "
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '$owner_id';
    select public.player_group_battle_action('$battle_id', 'guard', '$action_id');
    select pg_sleep(2);
    commit;
  "
}

act >"$action_log" 2>&1 &
action_first_pid=$!
sleep 0.5
set +e
act >>"$action_log" 2>&1
action_second_status=$?
wait "$action_first_pid"
action_first_status=$?
set -e
if [[ "$action_first_status" -ne 0 || "$action_second_status" -ne 0 ]]; then
  cat "$action_log" >&2
  echo "Concurrent retries of the same battle action must return successfully." >&2
  exit 1
fi

guard_count=$("${psql_cmd[@]}" -c "
  select count(*)
  from public.player_group_battles battle
  cross join lateral jsonb_array_elements(battle.action_log) item
  where battle.id = '$battle_id'
    and item ->> 'type' = 'player'
    and item ->> 'user_id' = '$owner_id'
    and item ->> 'action' = 'guard'
")
if [[ "$guard_count" != "1" ]]; then
  echo "The concurrent action was applied $guard_count times instead of once." >&2
  exit 1
fi

echo "PASS concurrent invitation, join and action retries"
