"""Stories CRUD, views, reactions and replies tests."""

import io


def _create_story(client, auth, caption="My story", media=None, **extra):
    payload = {"caption": caption}
    if media is not None:
        payload["media"] = media
    payload.update(extra)
    return client.post("/api/stories", json=payload, headers=auth)


def test_create_story(client, auth_headers):
    ctx = auth_headers("storier")
    r = _create_story(
        client, ctx["auth"], caption="Hello ARMY 💜", media={"type": "image", "src": "/x.svg"}
    )
    assert r.status_code == 200
    story = r.json()["story"]
    assert story["caption"] == "Hello ARMY 💜"
    assert story["user"] == ctx["user"]["id"]
    assert story["viewers"] == 0
    assert "expiresAt" in story


def test_create_story_requires_auth(client):
    r = _create_story(client, {}, caption="no auth")
    assert r.status_code == 401


def test_create_story_validation(client, auth_headers):
    ctx = auth_headers("valstory")
    # Empty caption & no media -> 400
    r = _create_story(client, ctx["auth"], caption="")
    assert r.status_code == 400
    # Caption too long -> 422
    r = _create_story(client, ctx["auth"], caption="x" * 2000)
    assert r.status_code == 422


def test_list_stories_unauth_ok(client, auth_headers):
    ctx = auth_headers("liststorier")
    _create_story(client, ctx["auth"], caption="one")
    r = client.get("/api/stories")
    assert r.status_code == 200
    assert len(r.json()["stories"]) == 1


def test_get_story(client, auth_headers):
    ctx = auth_headers("getstorier")
    story = _create_story(client, ctx["auth"], caption="find me").json()["story"]
    r = client.get(f"/api/stories/{story['id']}")
    assert r.status_code == 200
    assert r.json()["story"]["id"] == story["id"]


def test_get_story_not_found(client, auth_headers):
    r = client.get("/api/stories/nope")
    assert r.status_code == 404


def test_delete_own_story(client, auth_headers):
    ctx = auth_headers("delstorier")
    story = _create_story(client, ctx["auth"], caption="bye").json()["story"]
    r = client.delete(f"/api/stories/{story['id']}", headers=ctx["auth"])
    assert r.status_code == 200
    assert client.get(f"/api/stories/{story['id']}").status_code == 404


def test_delete_other_users_story_forbidden(client, auth_headers):
    owner = auth_headers("delownstorier")["auth"]
    story = _create_story(client, owner, caption="mine").json()["story"]
    attacker = auth_headers("delattackerstory")["auth"]
    r = client.delete(f"/api/stories/{story['id']}", headers=attacker)
    assert r.status_code == 403


def test_delete_requires_auth(client, auth_headers):
    ctx = auth_headers("delauthstory")
    story = _create_story(client, ctx["auth"], caption="x").json()["story"]
    assert client.delete(f"/api/stories/{story['id']}").status_code == 401


def test_view_story_counts_views(client, auth_headers):
    owner = auth_headers("storyown")["auth"]
    story = _create_story(client, owner, caption="watch me").json()["story"]
    viewer = auth_headers("storyviewer")["auth"]
    r = client.post(f"/api/stories/{story['id']}/view", headers=viewer)
    assert r.status_code == 200
    assert r.json()["viewers"] == 1
    # Same viewer views twice -> still 1
    client.post(f"/api/stories/{story['id']}/view", headers=viewer)
    r = client.get(f"/api/stories/{story['id']}", headers=viewer)
    assert r.json()["story"]["viewers"] == 1
    assert r.json()["story"]["viewedByMe"] is True


def test_view_own_story_not_counted(client, auth_headers):
    ctx = auth_headers("ownview")
    story = _create_story(client, ctx["auth"], caption="mine").json()["story"]
    r = client.post(f"/api/stories/{story['id']}/view", headers=ctx["auth"])
    assert r.status_code == 200
    assert r.json()["viewers"] == 0


def test_react_and_toggle(client, auth_headers):
    owner = auth_headers("reactown")["auth"]
    story = _create_story(client, owner, caption="r").json()["story"]
    actor = auth_headers("reactor")["auth"]
    r = client.post(
        f"/api/stories/{story['id']}/reaction",
        json={"type": "heart"},
        headers=actor,
    )
    assert r.status_code == 200
    assert r.json()["reacted"] is True
    assert r.json()["reaction"] == "heart"
    # Toggle off when same type sent again
    r = client.post(
        f"/api/stories/{story['id']}/reaction",
        json={"type": "heart"},
        headers=actor,
    )
    assert r.json()["reacted"] is False


def test_react_invalid_type(client, auth_headers):
    ctx = auth_headers("reactinvalid")
    story = _create_story(client, ctx["auth"], caption="x").json()["story"]
    other = auth_headers("reactinval2")["auth"]
    r = client.post(
        f"/api/stories/{story['id']}/reaction",
        json={"type": "banana"},
        headers=other,
    )
    assert r.status_code == 400


def test_reply_to_story(client, auth_headers):
    owner = auth_headers("replyown")["auth"]
    story = _create_story(client, owner, caption="r").json()["story"]
    replier = auth_headers("replier")["auth"]
    r = client.post(
        f"/api/stories/{story['id']}/replies",
        json={"text": "so cool!"},
        headers=replier,
    )
    assert r.status_code == 200
    assert r.json()["reply"]["text"] == "so cool!"
    # list replies
    lr = client.get(
        f"/api/stories/{story['id']}/replies", headers=replier
    )
    assert lr.status_code == 200
    assert len(lr.json()["replies"]) == 1


def test_reply_notifies_owner(client, auth_headers):
    owner = auth_headers("notifnown")["auth"]
    story = _create_story(client, owner, caption="r").json()["story"]
    replier = auth_headers("notifplier")["auth"]
    client.post(
        f"/api/stories/{story['id']}/replies",
        json={"text": "hello"},
        headers=replier,
    )
    notif = client.get("/api/notifications", headers=owner)
    assert notif.status_code == 200
    assert len(notif.json()["notifications"]) == 1
    assert notif.json()["notifications"][0]["type"] == "story_reply"


def test_reply_validation(client, auth_headers):
    ctx = auth_headers("replyvalid")
    story = _create_story(client, ctx["auth"], caption="x").json()["story"]
    r = client.post(
        f"/api/stories/{story['id']}/replies",
        json={"text": ""},
        headers=ctx["auth"],
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Media upload tests
# ---------------------------------------------------------------------------


def test_upload_image_story_media(client, auth_headers):
    """Authenticated user can upload an image for a story."""
    ctx = auth_headers("uploadimg")
    img_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xd9"
    )
    r = client.post(
        "/api/stories/upload",
        files={"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["media"]["type"] == "image"
    assert data["media"]["url"].startswith("/api/media/stories/")


def test_upload_video_story_media(client, auth_headers):
    """Authenticated user can upload a video for a story."""
    ctx = auth_headers("uploadvid")
    video_bytes = b"\x00" * 100
    r = client.post(
        "/api/stories/upload",
        files={"file": ("test.mp4", io.BytesIO(video_bytes), "video/mp4")},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["media"]["type"] == "video"
    assert data["media"]["url"].startswith("/api/media/stories/")


def test_upload_requires_auth(client):
    """Unauthenticated user cannot upload media."""
    img_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
    r = client.post(
        "/api/stories/upload",
        files={"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )
    assert r.status_code == 401


def test_upload_rejects_unsupported_type(client, auth_headers):
    """Upload of unsupported file type is rejected."""
    ctx = auth_headers("uploadbad")
    r = client.post(
        "/api/stories/upload",
        files={"file": ("test.exe", io.BytesIO(b"\x00" * 10), "application/x-executable")},
        headers=ctx["auth"],
    )
    assert r.status_code == 400


def test_upload_rejects_empty_file(client, auth_headers):
    """Upload of empty file is rejected."""
    ctx = auth_headers("uploadempty")
    r = client.post(
        "/api/stories/upload",
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
        headers=ctx["auth"],
    )
    assert r.status_code == 400


def test_create_story_with_uploaded_media(client, auth_headers):
    """Story creation with uploaded media URL works."""
    ctx = auth_headers("createmedia")
    r = _create_story(
        client,
        ctx["auth"],
        caption="My media story",
        media={"type": "image", "url": "/api/media/stories/test.jpg"},
    )
    assert r.status_code == 200
    story = r.json()["story"]
    assert story["mediaType"] == "image"
    assert story["media"]["url"] == "/api/media/stories/test.jpg"


def test_create_story_video_media_type(client, auth_headers):
    """Story creation with video media sets mediaType correctly."""
    ctx = auth_headers("createvidmedia")
    r = _create_story(
        client,
        ctx["auth"],
        caption="Video story",
        media={"type": "video", "url": "/api/media/stories/test.mp4"},
    )
    assert r.status_code == 200
    story = r.json()["story"]
    assert story["mediaType"] == "video"


def test_create_story_invalid_media_type(client, auth_headers):
    """Story creation with invalid media type is rejected."""
    ctx = auth_headers("badmediatype")
    r = _create_story(
        client,
        ctx["auth"],
        caption="Bad media",
        media={"type": "audio", "url": "/api/media/stories/test.mp3"},
    )
    assert r.status_code == 400


def test_create_story_media_without_url(client, auth_headers):
    """Story creation with media but no URL is rejected."""
    ctx = auth_headers("nourlmedia")
    r = _create_story(
        client,
        ctx["auth"],
        caption="No URL",
        media={"type": "image"},
    )
    assert r.status_code == 400


def test_story_expires_at_present(client, auth_headers):
    """Created story includes expiresAt field."""
    ctx = auth_headers("expirespresent")
    r = _create_story(client, ctx["auth"], caption="expires")
    assert r.status_code == 200
    story = r.json()["story"]
    assert "expiresAt" in story
    assert story["expiresAt"] != ""


def test_story_media_type_in_response(client, auth_headers):
    """Story response includes mediaType field."""
    ctx = auth_headers("mediatyperesponse")
    r = _create_story(
        client,
        ctx["auth"],
        caption="Check type",
        media={"type": "image", "url": "/api/media/stories/test.jpg"},
    )
    assert r.status_code == 200
    story = r.json()["story"]
    assert "mediaType" in story
    assert story["mediaType"] == "image"


# ---------------------------------------------------------------------------
# Deezer story music tests
# ---------------------------------------------------------------------------


def test_create_story_with_deezer_music(client, auth_headers):
    """Story creation with a Deezer music object is accepted."""
    ctx = auth_headers("deezermusic")
    music = {
        "id": "deezer-1564465082",
        "deezerId": 1564465082,
        "provider": "deezer",
        "providerTrackId": 1564465082,
        "title": "Dynamite",
        "artist": "BTS",
        "album": "BE",
        "artworkUrl": "https://e-cdns-images.dzcdn.net/images/cover/x/500x500.jpg",
        "cover": "https://e-cdns-images.dzcdn.net/images/cover/x/500x500.jpg",
        "duration": 228,
        "previewUrl": "https://cdns-preview-x.dzcdn.net/stream/aud-x/x.mp3",
        "canPlay": True,
        "startAt": 0,
        "endAt": 15,
    }
    r = _create_story(
        client,
        ctx["auth"],
        caption="Deezer story",
        media={"type": "image", "url": "/api/media/stories/test.jpg"},
        music=music,
    )
    assert r.status_code == 200
    story = r.json()["story"]
    assert story["music"]["id"] == "deezer-1564465082"
    assert story["music"]["provider"] == "deezer"
    assert story["music"]["deezerId"] == 1564465082
    assert story["music"]["title"] == "Dynamite"
    assert story["music"]["startAt"] == 0
    assert story["music"]["endAt"] == 15


def test_create_story_with_deezer_music_roundtrip(client, auth_headers):
    """A Deezer music story is returned unchanged when fetched."""
    ctx = auth_headers("deezerrnd")
    music = {
        "id": "deezer-3907717261",
        "deezerId": 3907717261,
        "provider": "deezer",
        "providerTrackId": 3907717261,
        "title": "SWIM",
        "artist": "RM",
        "album": "Right Place, Wrong Person",
        "artworkUrl": "https://e-cdns-images.dzcdn.net/images/cover/y/500x500.jpg",
        "cover": "https://e-cdns-images.dzcdn.net/images/cover/y/500x500.jpg",
        "duration": 159,
        "previewUrl": "https://cdns-preview-y.dzcdn.net/stream/aud-y/y.mp3",
        "canPlay": True,
        "startAt": 0,
        "endAt": 15,
    }
    story = _create_story(
        client,
        ctx["auth"],
        caption="roundtrip",
        media={"type": "image", "url": "/api/media/stories/test.jpg"},
        music=music,
    ).json()["story"]
    r = client.get(f"/api/stories/{story['id']}", headers=ctx["auth"])
    assert r.status_code == 200
    got = r.json()["story"]["music"]
    assert got["id"] == music["id"]
    assert got["deezerId"] == music["deezerId"]
    assert got["provider"] == "deezer"
    assert got["title"] == "SWIM"
    assert got["artist"] == "RM"
    assert got["artworkUrl"] == music["artworkUrl"]
    assert got["startAt"] == 0
    assert got["endAt"] == 15


def test_delete_story_with_deezer_music(client, auth_headers):
    """Deleting a Deezer music story works (no local media cleanup needed)."""
    ctx = auth_headers("deezerdel")
    music = {
        "id": "deezer-1564465082",
        "deezerId": 1564465082,
        "provider": "deezer",
        "providerTrackId": 1564465082,
        "title": "Dynamite",
        "artist": "BTS",
        "album": "BE",
        "artworkUrl": "https://e-cdns-images.dzcdn.net/images/cover/x/500x500.jpg",
        "cover": "https://e-cdns-images.dzcdn.net/images/cover/x/500x500.jpg",
        "duration": 228,
        "previewUrl": "https://cdns-preview-x.dzcdn.net/stream/aud-x/x.mp3",
        "canPlay": True,
        "startAt": 0,
        "endAt": 15,
    }
    story = _create_story(
        client,
        ctx["auth"],
        caption="delete me",
        media={"type": "image", "url": "/api/media/stories/test.jpg"},
        music=music,
    ).json()["story"]
    r = client.delete(f"/api/stories/{story['id']}", headers=ctx["auth"])
    assert r.status_code == 200
    assert client.get(f"/api/stories/{story['id']}").status_code == 404