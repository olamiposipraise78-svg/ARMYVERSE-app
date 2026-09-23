"""Tests for reel endpoints."""

import io
import pytest


def _fake_video():
    return ("test.mp4", io.BytesIO(b"\x00" * 1024), "video/mp4")


def _upload_reel(client, headers):
    files = {"file": _fake_video()}
    r = client.post("/api/reels/upload", files=files, headers=headers)
    return r.json()["media"]["url"]


def _create_reel(client, headers, caption="Test reel"):
    media_url = _upload_reel(client, headers)
    r = client.post(
        "/api/reels",
        params={"media_url": media_url},
        json={"caption": caption, "hashtags": ["#BTS"], "audio_name": "Dynamite"},
        headers=headers,
    )
    return r.json()["reel"]


# ---- Upload ----
def test_upload_reel_media(client, auth_headers):
    h = auth_headers("reeluser")
    files = {"file": _fake_video()}
    res = client.post("/api/reels/upload", files=files, headers=h["auth"])
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["media"]["type"] == "video"
    assert data["media"]["url"].startswith("/api/media/reels/")


def test_upload_requires_auth(client):
    files = {"file": _fake_video()}
    res = client.post("/api/reels/upload", files=files)
    assert res.status_code in (401, 403)


def test_upload_rejects_invalid_type(client, auth_headers):
    h = auth_headers("reeluser2")
    files = {"file": ("test.exe", io.BytesIO(b"bad"), "application/exe")}
    res = client.post("/api/reels/upload", files=files, headers=h["auth"])
    assert res.status_code in (400, 422)


# ---- Create + Get ----
def test_create_and_get_reel(client, auth_headers):
    h = auth_headers("reeluser3")
    reel = _create_reel(client, h["auth"], "My first reel")
    assert reel["caption"] == "My first reel"
    assert reel["src"].startswith("/api/media/reels/")
    assert reel["author"]["username"] == "reeluser3"
    assert reel["likeCount"] == 0
    assert reel["commentCount"] == 0
    assert reel["viewCount"] == 0

    res = client.get(f"/api/reels/{reel['id']}")
    assert res.status_code == 200
    assert res.json()["reel"]["id"] == reel["id"]


def test_create_reel_requires_media_url(client, auth_headers):
    h = auth_headers("reeluser4")
    res = client.post(
        "/api/reels",
        params={"media_url": ""},
        json={"caption": "test"},
        headers=h["auth"],
    )
    assert res.status_code == 400


def test_create_reel_with_crop_persists(client, auth_headers):
    h = auth_headers("reelcrop")
    media_url = _upload_reel(client, h["auth"])
    crop = {"aspect": "9:16", "zoom": 2.0, "x": 0, "y": 0.25}
    res = client.post(
        "/api/reels",
        params={"media_url": media_url},
        json={"caption": "cropped", "crop": crop},
        headers=h["auth"],
    )
    assert res.status_code == 200
    reel = res.json()["reel"]
    assert reel["crop"] == crop

    g = client.get(f"/api/reels/{reel['id']}")
    assert g.status_code == 200
    assert g.json()["reel"]["crop"] == crop


def test_create_reel_without_crop_is_none(client, auth_headers):
    h = auth_headers("reelplain")
    res = client.post(
        "/api/reels",
        params={"media_url": _upload_reel(client, h["auth"])},
        json={"caption": "plain"},
        headers=h["auth"],
    )
    assert res.status_code == 200
    assert res.json()["reel"].get("crop") is None


def test_get_nonexistent_reel(client):
    res = client.get("/api/reels/nonexistent")
    assert res.status_code == 404


# ---- List ----
def test_list_reels(client, auth_headers):
    h = auth_headers("reeluser5")
    _create_reel(client, h["auth"], "Reel 1")
    _create_reel(client, h["auth"], "Reel 2")
    res = client.get("/api/reels")
    assert res.status_code == 200
    assert len(res.json()["reels"]) >= 2


# ---- Delete ----
def test_delete_own_reel(client, auth_headers):
    h = auth_headers("reeluser6")
    reel = _create_reel(client, h["auth"], "Delete me")
    res = client.delete(f"/api/reels/{reel['id']}", headers=h["auth"])
    assert res.status_code == 200
    res2 = client.get(f"/api/reels/{reel['id']}")
    assert res2.status_code == 404


def test_cannot_delete_others_reel(client, auth_headers):
    h1 = auth_headers("reeluser7")
    h2 = auth_headers("reeluser8")
    reel = _create_reel(client, h1["auth"], "Not yours")
    res = client.delete(f"/api/reels/{reel['id']}", headers=h2["auth"])
    assert res.status_code == 403


# ---- Like / Unlike ----
def test_like_unlike_reel(client, auth_headers):
    h1 = auth_headers("reeluser9")
    h2 = auth_headers("reeluser10")
    reel = _create_reel(client, h1["auth"], "Like me")

    res = client.post(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    assert res.status_code == 200
    assert res.json()["liked"] is True

    res2 = client.delete(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    assert res2.status_code == 200
    assert res2.json()["liked"] is False


def test_like_updates_count(client, auth_headers):
    h1 = auth_headers("reeluser11")
    h2 = auth_headers("reeluser12")
    reel = _create_reel(client, h1["auth"])
    client.post(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    res = client.get(f"/api/reels/{reel['id']}")
    assert res.json()["reel"]["likeCount"] == 1
    client.delete(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    res2 = client.get(f"/api/reels/{reel['id']}")
    assert res2.json()["reel"]["likeCount"] == 0


# ---- Save / Unsave ----
def test_save_unsave_reel(client, auth_headers):
    h1 = auth_headers("reeluser13")
    h2 = auth_headers("reeluser14")
    reel = _create_reel(client, h1["auth"], "Save me")

    res = client.post(f"/api/reels/{reel['id']}/save", headers=h2["auth"])
    assert res.status_code == 200
    assert res.json()["saved"] is True

    res2 = client.delete(f"/api/reels/{reel['id']}/save", headers=h2["auth"])
    assert res2.status_code == 200
    assert res2.json()["saved"] is False


# ---- View ----
def test_view_reel_increments_count(client, auth_headers):
    h = auth_headers("reeluser15")
    reel = _create_reel(client, h["auth"], "View me")
    client.post(f"/api/reels/{reel['id']}/view", headers=h["auth"])
    res = client.get(f"/api/reels/{reel['id']}")
    assert res.json()["reel"]["viewCount"] == 1


def test_duplicate_view_not_double_counted(client, auth_headers):
    h = auth_headers("reeluser16")
    reel = _create_reel(client, h["auth"])
    client.post(f"/api/reels/{reel['id']}/view", headers=h["auth"])
    client.post(f"/api/reels/{reel['id']}/view", headers=h["auth"])
    res = client.get(f"/api/reels/{reel['id']}")
    assert res.json()["reel"]["viewCount"] == 1


# ---- Share ----
def test_share_reel_increments_count(client, auth_headers):
    h = auth_headers("reeluser17")
    reel = _create_reel(client, h["auth"], "Share me")
    res = client.post(f"/api/reels/{reel['id']}/share")
    assert res.status_code == 200
    assert res.json()["shareCount"] == 1


# ---- Comments ----
def test_add_and_list_comments(client, auth_headers):
    h1 = auth_headers("reeluser18")
    h2 = auth_headers("reeluser19")
    reel = _create_reel(client, h1["auth"], "Comment me")

    res = client.post(
        f"/api/reels/{reel['id']}/comments",
        json={"text": "Great reel!"},
        headers=h2["auth"],
    )
    assert res.status_code == 200
    comment = res.json()["comment"]
    assert comment["text"] == "Great reel!"
    assert comment["author"]["username"] == "reeluser19"

    res2 = client.get(f"/api/reels/{reel['id']}/comments")
    assert res2.status_code == 200
    assert len(res2.json()["comments"]) == 1


def test_comment_increments_reel_comment_count(client, auth_headers):
    h1 = auth_headers("reeluser20")
    h2 = auth_headers("reeluser21")
    reel = _create_reel(client, h1["auth"])
    client.post(
        f"/api/reels/{reel['id']}/comments",
        json={"text": "Nice!"},
        headers=h2["auth"],
    )
    res = client.get(f"/api/reels/{reel['id']}")
    assert res.json()["reel"]["commentCount"] == 1


def test_empty_comment_rejected(client, auth_headers):
    h1 = auth_headers("reeluser22")
    h2 = auth_headers("reeluser23")
    reel = _create_reel(client, h1["auth"])
    res = client.post(
        f"/api/reels/{reel['id']}/comments",
        json={"text": ""},
        headers=h2["auth"],
    )
    assert res.status_code == 422


# ---- Liked/Saved state in GET ----
def test_get_reel_shows_liked_saved_state(client, auth_headers):
    h1 = auth_headers("reeluser24")
    h2 = auth_headers("reeluser25")
    reel = _create_reel(client, h1["auth"])
    client.post(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    client.post(f"/api/reels/{reel['id']}/save", headers=h2["auth"])

    res = client.get(f"/api/reels/{reel['id']}", headers=h2["auth"])
    assert res.json()["reel"]["liked"] is True
    assert res.json()["reel"]["saved"] is True

    res2 = client.get(f"/api/reels/{reel['id']}", headers=h1["auth"])
    assert res2.json()["reel"]["liked"] is False
    assert res2.json()["reel"]["saved"] is False


# ---- Delete cascades ----
def test_delete_reel_removes_associations(client, auth_headers):
    h1 = auth_headers("reeluser26")
    h2 = auth_headers("reeluser27")
    reel = _create_reel(client, h1["auth"], "Cascade test")
    client.post(f"/api/reels/{reel['id']}/like", headers=h2["auth"])
    client.post(f"/api/reels/{reel['id']}/save", headers=h2["auth"])
    client.post(
        f"/api/reels/{reel['id']}/comments",
        json={"text": "Will be deleted"},
        headers=h2["auth"],
    )

    client.delete(f"/api/reels/{reel['id']}", headers=h1["auth"])
    res = client.get(f"/api/reels/{reel['id']}")
    assert res.status_code == 404
