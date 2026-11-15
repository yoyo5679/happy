"""Record public update counts on an audit branch, never on the protected deployment branch."""
import base64
import json
import os
import re
import urllib.error
import urllib.request

REPO = "yoyo5679/happy"
BRANCH = "ltc-update-reports"

def main():
    report = json.loads(os.environ["MONTHLY_REPORT"])
    if not re.fullmatch(r"\d{4}-\d{2}", report.get("period", "")) or not report.get("completedAt"):
        raise ValueError("Invalid completed update report")
    for key in ("scanned", "added", "updated", "unresolved"):
        if not isinstance(report.get(key), int) or report[key] < 0:
            raise ValueError("Invalid report counter")
    token = os.environ["GH_REPORT_TOKEN"]
    def api(path, method="GET", value=None):
        req = urllib.request.Request("https://api.github.com/repos/" + REPO + path,
            data=json.dumps(value).encode() if value is not None else None, method=method,
            headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "HappycareMonthlyAudit/1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    try:
        api("/git/ref/heads/" + BRANCH)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        api("/git/refs", "POST", {"ref": "refs/heads/" + BRANCH, "sha": os.environ["GITHUB_SHA"]})
    path = "/contents/reports/ltc/" + report["period"] + ".json"
    content = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode()
    payload = {"branch": BRANCH, "message": "Record monthly institution update " + report["period"], "content": base64.b64encode(content).decode()}
    try:
        existing = api(path + "?ref=" + BRANCH)
        if base64.b64decode(existing["content"]) == content:
            print("Completed report already recorded")
            return
        payload["sha"] = existing["sha"]
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    api(path, "PUT", payload)
    print("Recorded public update counts on " + BRANCH)

if __name__ == "__main__":
    main()
