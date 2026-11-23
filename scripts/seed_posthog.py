"""Generate and optionally ingest a reproducible, explicitly synthetic demo dataset.

Uses only Python's standard library. See docs/synthetic_dataset.md.
"""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import random
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import uuid

ROOT = Path(__file__).resolve().parents[1]
DATASET = 'fieldwork_synthetic_2000_v1'
START = datetime(2026, 10, 26, tzinfo=timezone.utc)
END = START + timedelta(days=28)
CATALOG = [('ridge-22', 'Ridge Daypack', 84), ('summit-750', 'Summit Bottle', 28)]


def iso(value):
    return value.isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def stable_uuid(key, timestamp):
    """Deterministic UUIDv7: timestamp plus 74 hash bits, for repeatable retries."""
    bits = int.from_bytes(hashlib.sha256(key.encode()).digest()[:10], 'big')
    value = (int(timestamp.timestamp() * 1000) << 80)
    value |= 7 << 76 | ((bits >> 62) & 0xfff) << 64
    value |= 2 << 62 | (bits & ((1 << 62) - 1))
    return str(uuid.UUID(int=value))


def generate():
    rng = random.Random(20261122)
    events = []
    for number in range(1, 2001):
        user = f'fieldwork-synth-v1-{number:04d}'
        device = rng.choices(['Mobile', 'Desktop'], [65, 35])[0]
        channel = rng.choices(['organic', 'email', 'paid_search', 'social'], [35, 25, 25, 15])[0]
        days = sorted(set([rng.randrange(14)] + [rng.randrange(14, 28) for _ in range(rng.randint(1, 3))]))
        for visit, day in enumerate(days):
            timestamp = START + timedelta(days=day, hours=rng.randrange(7, 22), minutes=rng.randrange(60))
            session = stable_uuid(f'{user}:visit:{visit}', timestamp)
            base = dict(is_demo=True, is_synthetic=True, dataset_id=DATASET,
                        data_source='synthetic_seed', generation_method='scripted_simulation',
                        auth_status='signed_in', demo_user_id=user, demo_session_id=session,
                        device=device, acquisition_channel=channel, utm_source=channel,
                        utm_medium={'organic': 'search', 'email': 'email', 'paid_search': 'cpc', 'social': 'social'}[channel],
                        utm_campaign='synthetic_analytics_demo', visit_number=visit + 1,
                        customer_type='new' if visit == 0 else 'returning',
                        period='recent_week' if day >= 21 else 'prior_week' if day >= 14 else 'baseline',
                        **{'$device_type': device, '$browser': 'Synthetic browser',
                           '$os': 'Synthetic OS', '$host': 'fieldwork-checkout-lab.bapnocap.chatgpt.site',
                           '$current_url': 'https://fieldwork-checkout-lab.bapnocap.chatgpt.site/',
                           '$is_identified': True})
            sequence = 0

            def emit(name, **properties):
                nonlocal timestamp, sequence
                timestamp += timedelta(seconds=rng.randrange(8, 75))
                sequence += 1
                events.append(dict(event=name, distinct_id=user,
                    uuid=stable_uuid(f'{session}:{sequence}:{name}', timestamp),
                    timestamp=iso(timestamp), session_id=session,
                    options=dict(process_person_profile=True, disable_skew_correction=True),
                    properties={**base, 'event_sequence': sequence, **properties}))

            if visit == 0:
                emit('$identify', **{'$set': dict(name=f'Synthetic Shopper {number:04d}',
                     is_demo=True, is_synthetic=True, dataset_id=DATASET,
                     acquisition_channel=channel, preferred_device=device),
                     '$set_once': {'synthetic_signup_at': iso(timestamp)}})
            emit('$pageview')
            emit('demo_signed_in')
            item = rng.choices(CATALOG, [45 if device == 'Mobile' else 65, 55 if device == 'Mobile' else 35])[0]
            item_properties = dict(item_id=item[0], item_name=item[1], price=item[2], currency='USD')
            emit('view_item', **item_properties)
            if rng.random() < .22:
                other = CATALOG[1] if item == CATALOG[0] else CATALOG[0]
                emit('view_item', item_id=other[0], item_name=other[1], price=other[2], currency='USD')
            if rng.random() < (.68 if channel == 'email' else .53):
                quantity = rng.choices([1, 2, 3], [80, 17, 3])[0]
                emit('add_to_cart', **item_properties, quantity=quantity)
                items = [dict(item_id=item[0], item_name=item[1], price=item[2], quantity=quantity)]
                if rng.random() < .18:
                    other = CATALOG[1] if item == CATALOG[0] else CATALOG[0]
                    items.append(dict(item_id=other[0], item_name=other[1], price=other[2], quantity=1))
                    emit('add_to_cart', **items[-1], currency='USD')
                if rng.random() < .12:
                    removed = items.pop()
                    emit('remove_from_cart', **removed, currency='USD')
                if items and rng.random() < .80:
                    checkout = stable_uuid(session + ':checkout', timestamp)
                    details = dict(checkout_id=checkout, items=items, currency='USD',
                                   value=sum(i['price'] * i['quantity'] for i in items))
                    emit('begin_checkout', **details)
                    payment_rate = .50 if device == 'Mobile' and day >= 21 else .80
                    if rng.random() < payment_rate:
                        emit('add_payment_info', **details, payment_type='demo')
                        if rng.random() < .87:
                            emit('purchase', **details, transaction_id=stable_uuid(session + ':order', timestamp))
                    elif device == 'Mobile' and day >= 21 and rng.random() < .65:
                        emit('payment_error', **details, error_code='synthetic_payment_validation')
            if rng.random() < .35:
                emit('demo_signed_out')
    return sorted(events, key=lambda event: (event['timestamp'], event['uuid']))


def validate(events):
    assert len({e['distinct_id'] for e in events}) == 2000
    assert len({e['uuid'] for e in events}) == len(events)
    sessions = {}
    for event in events:
        assert event['properties']['is_synthetic'] is True
        assert START <= datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00')) < END
        assert uuid.UUID(event['uuid']).version == 7
        sessions.setdefault(event['session_id'], []).append(event)
    for rows in sessions.values():
        names = [e['event'] for e in rows]
        if 'purchase' in names:
            assert names.index('begin_checkout') < names.index('add_payment_info') < names.index('purchase')
            stages = [e for e in rows if e['event'] in ('begin_checkout', 'add_payment_info', 'purchase')]
            assert len({e['properties']['checkout_id'] for e in stages}) == 1
            for event in stages:
                assert event['properties']['value'] == sum(i['price'] * i['quantity'] for i in event['properties']['items'])
    return dict(dataset_id=DATASET, users=2000, sessions=len(sessions), events=len(events),
        start=iso(START), end_exclusive=iso(END), event_counts=dict(Counter(e['event'] for e in events)))


def upload(events, token, host, state_path, historical=True):
    state = json.loads(state_path.read_text()) if state_path.exists() else dict(dataset_id=DATASET, accepted=[])
    if state['dataset_id'] != DATASET:
        raise ValueError('Checkpoint belongs to a different dataset')
    accepted = set(state['accepted'])
    for offset in range(0, len(events), 500):
        batch = [e for e in events[offset:offset + 500] if e['uuid'] not in accepted]
        attempt = 0
        request_id = str(uuid.uuid4())
        while batch:
            attempt += 1
            now = iso(datetime.now(timezone.utc))
            payload = json.dumps(dict(created_at=now, historical_migration=historical, batch=batch)).encode()
            headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
                'User-Agent': 'fieldwork-synthetic-seeder/1.0', 'PostHog-Sdk-Info': 'fieldwork-synthetic-seeder/1.0',
                'PostHog-Request-Id': request_id, 'PostHog-Attempt': str(attempt), 'PostHog-Request-Timestamp': now}
            try:
                with urlopen(Request(host.rstrip('/') + '/i/v1/analytics/events', payload, headers), timeout=45) as response:
                    result = json.load(response)
            except (HTTPError, URLError) as error:
                if isinstance(error, HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                    raise RuntimeError(f'Capture rejected batch: HTTP {error.code}') from None
                if attempt >= 5:
                    raise RuntimeError('Capture request failed after five attempts; rerun to resume') from None
                time.sleep(min(2 ** attempt, 20))
                continue
            statuses = result.get('results')
            if not isinstance(statuses, dict) or any(e['uuid'] not in statuses for e in batch):
                raise RuntimeError('Missing per-event capture results; stopped without assuming success')
            rejected = []
            retry = []
            for event in batch:
                outcome = statuses[event['uuid']]
                if outcome['result'] == 'ok' and not outcome.get('details'):
                    accepted.add(event['uuid'])
                elif outcome['result'] == 'retry':
                    retry.append(event)
                else:
                    rejected.append(dict(uuid=event['uuid'], **outcome))
            state['accepted'] = sorted(accepted)
            state_path.write_text(json.dumps(state))
            if rejected:
                raise RuntimeError(f'Capture returned dropped/warning events: {rejected[:3]}')
            batch = retry
            if batch:
                if attempt >= 5:
                    raise RuntimeError('Some events still need retry; rerun to resume')
                time.sleep(min(2 ** attempt, 20))
                request_id = str(uuid.uuid4())
        print(f'Accepted {len(accepted)}/{len(events)} events', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--upload', action='store_true', help='Send to configured PostHog project')
    args = parser.parse_args()
    out = ROOT / 'data' / DATASET
    out.mkdir(parents=True, exist_ok=True)
    events = generate()
    summary = validate(events)
    (out / 'events.jsonl').write_text(''.join(json.dumps(e) + '\n' for e in events))
    (out / 'manifest.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2), flush=True)
    if args.upload:
        config = dict(os.environ)
        env_path = ROOT / 'sites/fieldwork-supply/.env'
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    config.setdefault(key, value)
        token, host = config['POSTHOG_PROJECT_TOKEN'], config['POSTHOG_HOST']
        if host != 'https://us.i.posthog.com' or not token.startswith('phc_'):
            raise ValueError('Expected the connected US PostHog project configuration')
        upload(events, token, host, out / 'upload-state.json')


if __name__ == '__main__':
    main()
