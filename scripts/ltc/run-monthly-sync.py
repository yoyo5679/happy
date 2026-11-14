"""Resume the server-owned monthly job using a short-lived GitHub OIDC identity.
Provider API keys and database credentials stay in Cloudflare, never in this runner.
"""
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://happycare.pages.dev"
AUDIENCE = BASE + "/ltc-monthly"

def oidc_token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    url += ("&" if "?" in url else "?") + urllib.parse.urlencode({"audience": AUDIENCE})
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)["value"]

def main():
    deadline = time.monotonic() + 4 * 3600
    token, token_at, failures, last_log = "", 0, 0, 0
    while time.monotonic() < deadline:
        if time.monotonic() - token_at > 180 or not token:
            token, token_at = oidc_token(), time.monotonic()
        req = urllib.request.Request(BASE + "/api/ltc/monthly-sync", data=b"", method="POST", headers={"Authorization": "Bearer " + token})
        try:
            with urllib.request.urlopen(req, timeout=110) as response:
                result = json.load(response)
        except (urllib.error.URLError, TimeoutError) as error:
            failures += 1
            # A code push can reach Actions before the Pages deployment is ready.
            code = getattr(error, "code", "network")
            print(f"Update temporarily unavailable ({code}); retry {failures}/12", flush=True)
            if failures >= 12:
                raise RuntimeError("Monthly update paused; the next scheduled run resumes its saved cursor") from None
            token = "" if code == 401 else token
            time.sleep(30)
            continue
        failures = 0
        job = result.get("job") or {}
        if time.monotonic() - last_log > 30 or result.get("done"):
            print(json.dumps(job, ensure_ascii=False), flush=True)
            last_log = time.monotonic()
        if result.get("done"):
            if not job.get("completedAt"):
                raise RuntimeError("Server reported completion without a completed job")
            target = Path("public/ltc/monthly-update.json")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            summary = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary:
                with open(summary, "a", encoding="utf-8") as handle:
                    handle.write(f"## 기관 업데이트 {job['period']}\n\n지정일 조회 범위: {job['from']} ~ {job['to']}\n\n")
                    handle.write(f"신규 추가 **{job['added']}곳** · 기존 갱신 **{job['updated']}곳** · 지도 확인 대기 **{job['unresolved']}곳**\n")
            return
        time.sleep(2 if result.get("busy") else 0.2)
    raise RuntimeError("Run time limit reached; progress is saved for the next scheduled run")

if __name__ == "__main__":
    main()
