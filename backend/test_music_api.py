import requests
try:
    r = requests.get("http://localhost:8000/api/music", timeout=5)
    data = r.json()
    print("Status:", r.status_code)
    print("Songs:", data.get("total", 0))
    if data.get("songs"):
        s = data["songs"][0]
        print("First song:", s["title"], "- hasAudio:", s["hasAudio"], "- provider:", s["provider"])
except Exception as e:
    print("Error:", e)
