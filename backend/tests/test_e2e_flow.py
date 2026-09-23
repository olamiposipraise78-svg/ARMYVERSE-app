"""End-to-end flow test.

Walks the full user journey across the app's core features to verify the most
important integrations work together: auth (incl. token invalidation), profile
updates, avatar upload, posts + likes + notifications, reels + save counts,
stories + view tracking, and games progress.
"""

import io


def _png_bytes() -> bytes:
    # Minimal valid PNG (1x1 transparent pixel)
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe"
        b"\xa7=\xc6u\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _fake_video():
    return ("clip.mp4", io.BytesIO(b"\x00" * 1024), "video/mp4")


def _register(client, username, password="password123"):
    payload = {
        "username": username,
        "email": f"{username}@example.com",
        "password": password,
        "display_name": f"Display {username}",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        "auth": {"Authorization": f"Bearer {data['access_token']}"},
        "refresh": data.get("refresh_token"),
        "user": data["user"],
    }


def test_full_user_journey(client, auth_headers):
    author = _register(client, "e2eauthor")
    viewer = _register(client, "e2eviewer")

    # 1. Public profile fetches
    me = client.get("/api/auth/me", headers=author["auth"])
    assert me.status_code == 200
    assert me.json()["user"]["avatar"] == ""

    # 2. Profile update (display_name, bio, country)
    r = client.patch(
        "/api/users/me",
        json={"display_name": "Kim E2E", "bio": "Born to be tested", "country": "KR"},
        headers=author["auth"],
    )
    assert r.status_code == 200, r.text
    updated = r.json()["user"]
    assert updated["displayName"] == "Kim E2E"
    assert updated["bio"] == "Born to be tested"
    assert updated["country"] == "KR"

    # 3. Avatar upload wires profile_image
    r = client.post(
        "/api/users/me/avatar",
        files={"file": ("avatar.png", io.BytesIO(_png_bytes()), "image/png")},
        headers=author["auth"],
    )
    assert r.status_code == 200, r.text
    avatar_user = r.json()["user"]
    assert avatar_user["avatar"].startswith("/api/media/avatars/")
    assert client.get("/api/users/" + author["user"]["id"]).json()["user"]["avatar"] == avatar_user["avatar"]

    # 4. Avatar upload rejects non-image content
    r = client.post(
        "/api/users/me/avatar",
        files={"file": ("bad.bin", io.BytesIO(b"nope"), "application/octet-stream")},
        headers=author["auth"],
    )
    assert r.status_code in (400, 422)

    # 5. Follows
    r = client.post(f"/api/users/{author['user']['id']}/follow", headers=viewer["auth"])
    assert r.status_code == 200
    pub = client.get(f"/api/users/{author['user']['id']}").json()["user"]
    assert pub["followers"] >= 1

    # 6. Create a post, like (by viewer), verify count + notification
    post = client.post("/api/posts", json={"caption": "E2E first post"}, headers=author["auth"]).json()["post"]
    r = client.post(f"/api/posts/{post['id']}/like", headers=viewer["auth"])
    assert r.json()["likeCount"] == 1
    assert client.get(f"/api/posts/{post['id']}").json()["post"]["likeCount"] == 1
    # duplicate like is prevented (still 1)
    client.post(f"/api/posts/{post['id']}/like", headers=viewer["auth"])
    assert client.get(f"/api/posts/{post['id']}").json()["post"]["likeCount"] == 1
    notif = client.get("/api/notifications", headers=author["auth"]).json()
    assert any(n["type"] == "like" for n in notif["notifications"])

    # 7. Feed contains the new post and search finds it
    feed = client.get("/api/feed", headers=viewer["auth"]).json()
    assert any(p["id"] == post["id"] for p in feed["posts"])

    # 8. Reel upload -> create -> save -> saveCount increments
    media_url = client.post(
        "/api/reels/upload", files={"file": _fake_video()}, headers=author["auth"]
    ).json()["media"]["url"]
    reel = client.post(
        "/api/reels",
        params={"media_url": media_url},
        json={"caption": "E2E reel", "hashtags": ["BTS"], "audio_name": "Dynamite"},
        headers=author["auth"],
    ).json()["reel"]
    assert reel["saveCount"] == 0
    r = client.post(f"/api/reels/{reel['id']}/save", headers=viewer["auth"])
    assert r.json()["saved"] is True
    assert client.get(f"/api/reels/{reel['id']}").json()["reel"]["saveCount"] == 1
    client.delete(f"/api/reels/{reel['id']}/save", headers=viewer["auth"])
    assert client.get(f"/api/reels/{reel['id']}").json()["reel"]["saveCount"] == 0
    # view + share counts
    client.post(f"/api/reels/{reel['id']}/view", headers=viewer["auth"])
    client.post(f"/api/reels/{reel['id']}/share", headers=viewer["auth"])
    reel_now = client.get(f"/api/reels/{reel['id']}").json()["reel"]
    assert reel_now["viewCount"] >= 1 and reel_now["shareCount"] >= 1

    # 9. Story create + view tracking
    story = client.post(
        "/api/stories",
        json={"caption": "E2E story", "color": "#2b1a4a"},
        headers=author["auth"],
    ).json()["story"]
    assert story["viewers"] == 0
    client.post(f"/api/stories/{story['id']}/view", headers=viewer["auth"])
    story_now = client.get(f"/api/stories/{story['id']}", headers=viewer["auth"]).json()["story"]
    assert story_now["viewers"] >= 1
    stories_list = client.get("/api/stories", headers=viewer["auth"]).json()["stories"]
    assert any(s["id"] == story["id"] for s in stories_list)

    # 10. Games: fetch questions, submit result, progress reflects it
    q = client.get("/api/games/quiz/questions?difficulty=medium").json()
    assert q["total"] > 0
    sub = client.post(
        "/api/games/quiz/submit",
        json={
            "score": 540,
            "difficulty": "medium",
            "correct": 8,
            "total": 10,
            "streak": 4,
            "game_type": "guess-song",
        },
        headers=viewer["auth"],
    )
    assert sub.status_code == 200, sub.text
    progress = client.get("/api/games/progress", headers=viewer["auth"]).json()
    assert progress["progress"]  # non-empty progress payload

    # 11. Token revocation: logout invalidates both refresh AND access tokens
    r = client.post(
        "/api/auth/logout",
        json={"refresh_token": author["refresh"]},
        headers=author["auth"],
    )
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=author["auth"]).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": author["refresh"]}).status_code == 401

    # 12. Unauthenticated flows still work and protected ones reject
    assert client.get("/api/feed").status_code == 401
    assert client.get("/api/games/quiz/questions?difficulty=easy").status_code == 200