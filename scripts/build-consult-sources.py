"""Package source abstracts for the current displayed evidence; no search or model calls."""
from pathlib import Path
import csv,gzip,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'data/corpus/evidence_map.csv'
extended=json.loads((ROOT/'research/systematic_review/extended_evidence.json').read_text(encoding='utf-8'))['questions']
translations=json.loads((ROOT/'research/systematic_review/key_finding_translations_ko.json').read_text(encoding='utf-8'))['translations']
ko={(r['question_id'],r['record_id']):r['translation_ko'] for r in translations}
wanted={(q,r['record_id']):r for q,rows in extended.items() for r in rows}
groups={q:{} for q in extended}
with source.open(encoding='utf-8-sig',newline='') as handle:
 for row in csv.DictReader(handle):
  key=(row['question_id'],row['record_id'])
  item=wanted.get(key)
  if item is None:continue
  groups[key[0]][key[1]]={
   'recordId':key[1],'title':row['title'],'year':row['year'],'publicationTypes':row['publication_types'],
   'abstract':row['abstract'],'finding':item['key_finding'],'findingKo':ko.get(key,''),
   'population':item.get('population',''),'dose':item.get('dose',''),'outcome':item.get('outcome',''),
   'locator':item['locator'],'url':item['url'],'reviewed':key in ko,
  }
assert sum(map(len,groups.values()))==len(wanted)
out=(ROOT/'research/consult').resolve();out.relative_to(ROOT);out.mkdir(parents=True,exist_ok=True)
manifest={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'questions':{}}
for q,records in groups.items():
 data=json.dumps(records,ensure_ascii=False,separators=(',',':')).encode('utf-8')
 encoded=gzip.compress(data,mtime=0)
 (out/f'{q}.json.gz').write_bytes(encoded)
 manifest['questions'][q]={'records':len(records),'sha256':hashlib.sha256(encoded).hexdigest()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'records':len(wanted),'compressed_bytes':sum(p.stat().st_size for p in out.glob('*.gz'))}))
