#!/usr/bin/env python3
"""Capture a local production HTTP smoke test for protocol v2."""
import hashlib,json,os,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"research/validation/ai_exploratory_local_smoke.json";PORT=3101
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def request(url,data=None):
 req=urllib.request.Request(url,data=json.dumps(data).encode() if data else None,headers={"Content-Type":"application/json"} if data else {},method="POST" if data else "GET")
 with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
def main():
 npm="npm.cmd" if os.name=="nt" else "npm";proc=subprocess.Popen([npm,"start","--","-p",str(PORT)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 try:
  for _ in range(50):
   try:status,home=request(f"http://127.0.0.1:{PORT}/");break
   except Exception:time.sleep(.2)
  else:raise RuntimeError("production server did not become ready")
  api_status,raw=request(f"http://127.0.0.1:{PORT}/api/exploratory/query",{"profile":{"medications":["warfarin"]},"candidateItems":[{"name":"vitamin K"}]});api=json.loads(raw)
  payload={"schema_version":"1.0.0","status":"local_production_smoke_verified","base_url":f"http://127.0.0.1:{PORT}","home_status":status,"api_status":api_status,"scope":api.get("scope"),"navigation_count":len(api.get("navigation",[])),"question_ids":[x["question_id"] for x in api.get("navigation",[])],"clinical_action_count":len(api.get("clinical_actions",[])),"legacy_leakage":b"RULE-VIT" in raw or b"legacy_unverified" in raw,"validated_scope_leakage":b"validated_thesis_scope" in raw,"response_sha256":hashlib.sha256(raw).hexdigest(),"source_hashes":{"engine":sha(ROOT/"src/engine/run-ai-exploratory-engine.ts"),"bundle":sha(ROOT/"src/generated/ai-exploratory-bundle.json"),"route":sha(ROOT/"app/api/exploratory/query/route.ts")}}
  OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(payload,ensure_ascii=False));return 0
 finally:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill()
if __name__=="__main__":raise SystemExit(main())
