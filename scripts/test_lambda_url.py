import json
import urllib.request
import urllib.error

url = "https://jevzoaxlk3frnqb5n2xgmsx5k40inznk.lambda-url.us-east-1.on.aws"
req = urllib.request.Request(
    url,
    data=json.dumps({"text": "test"}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    resp = urllib.request.urlopen(req)
    print("Status:", resp.status, resp.read().decode())
except urllib.error.HTTPError as e:
    print("Status:", e.code, e.read().decode())
