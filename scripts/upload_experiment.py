"""Upload the reproducible experiment event log. Credentials remain in ignored .env."""
import json
from pathlib import Path
import seed_posthog
from seed_posthog import upload
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'data/fieldwork_experiment_2000_v1'
config = {}
for line in (ROOT / '.env').read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        k,v = line.split('=',1)
        config[k] = v.strip().strip('"').strip("'")
seed_posthog.DATASET = 'fieldwork_experiment_2000_v1'
checkpoint=out/'upload-state.json'
if checkpoint.exists():
    state=json.loads(checkpoint.read_text());state['dataset_id']=seed_posthog.DATASET;checkpoint.write_text(json.dumps(state))
events = [json.loads(line) for line in (out / 'events.jsonl').read_text().splitlines()]
assert len({e['distinct_id'] for e in events}) == 2000
assert all(e['properties']['is_synthetic'] and e['properties']['dataset_id']=='fieldwork_experiment_2000_v1' for e in events)
assert config['POSTHOG_HOST']=='https://us.i.posthog.com'
upload(events,config['POSTHOG_PROJECT_TOKEN'],config['POSTHOG_HOST'],out/'upload-state.json')
