"""Post CRUD and ownership tests."""


def _create_post(client, auth, caption="Test caption", **extra):
    payload = {"caption": caption}
    payload.update(extra)
    return client.post("/api/posts", json=payload, headers=auth)


def test_create_post(client, auth_headers):
    ctx = auth_headers("poster")
    r = _create_post(client, ctx["auth"], caption="Hello ARMY 💜")
    assert r.status_code == 200
    post = r.json()["post"]
    assert post["text"] == "Hello ARMY 💜"
    assert post["likeCount"] == 0
    assert post["user"] == ctx["user"]["id"]


def test_create_post_requires_auth(client):
    r = _create_post(client, {}, caption="no auth")
    assert r.status_code == 401


def test_create_post_validation(client, auth_headers):
    ctx = auth_headers("validatep")
    # Empty caption & no media -> 400
    r = _create_post(client, ctx["auth"], caption="")
    assert r.status_code == 400
    # Caption too long -> 422
    r = _create_post(client, ctx["auth"], caption="x" * 2000)
    assert r.status_code == 422


def test_list_posts_unauth_ok(client, auth_headers, make_user):
    # posts list is public
    ctx = auth_headers("listposter")
    _create_post(client, ctx["auth"], caption="one")
    r = client.get("/api/posts")
    assert r.status_code == 200
    assert len(r.json()["posts"]) == 1


def test_get_post(client, auth_headers):
    ctx = auth_headers("getposter")
    post = _create_post(client, ctx["auth"], caption="find me").json()["post"]
    r = client.get(f"/api/posts/{post['id']}")
    assert r.status_code == 200
    assert r.json()["post"]["id"] == post["id"]


def test_get_post_not_found(client):
    assert client.get("/api/posts/nope").status_code == 404


def test_create_post_with_crop_persists(client, auth_headers):
    ctx = auth_headers("cropuser")
    crop = {"aspect": "4:5", "zoom": 1.5, "x": -0.2, "y": 0.1}
    media = {"type": "image", "src": "/api/media/posts/crop.jpg", "crop": crop}
    r = _create_post(client, ctx["auth"], caption="cropped", media=media)
    assert r.status_code == 200
    post = r.json()["post"]
    assert post["media"]["crop"] == crop

    g = client.get(f"/api/posts/{post['id']}")
    assert g.status_code == 200
    assert g.json()["post"]["media"]["crop"] == crop


def test_create_post_without_crop_has_none(client, auth_headers):
    ctx = auth_headers("nocropuser")
    media = {"type": "image", "src": "/api/media/posts/plain.jpg"}
    r = _create_post(client, ctx["auth"], caption="plain", media=media)
    assert r.status_code == 200
    assert r.json()["post"]["media"].get("crop") is None


def test_update_own_post(client, auth_headers):
    ctx = auth_headers("editpost")
    post = _create_post(client, ctx["auth"], caption="original").json()["post"]
    r = client.patch(
        f"/api/posts/{post['id']}",
        json={"caption": "edited"},
        headers=ctx["auth"],
    )
    assert r.status_code == 200
    assert r.json()["post"]["text"] == "edited"


def test_update_other_users_post_forbidden(client, auth_headers, make_user):
    other = auth_headers("editother")["auth"]
    post = _create_post(client, other, caption="theirs").json()["post"]
    attacker = auth_headers("attacker")["auth"]
    r = client.patch(
        f"/api/posts/{post['id']}",
        json={"caption": "hijacked"},
        headers=attacker,
    )
    assert r.status_code == 403


def test_update_post_requires_auth(client, auth_headers):
    ctx = auth_headers("reqauth")
    post = _create_post(client, ctx["auth"], caption="x").json()["post"]
    r = client.patch(f"/api/posts/{post['id']}", json={"caption": "y"})
    assert r.status_code == 401


def test_delete_own_post(client, auth_headers):
    ctx = auth_headers("deleter")
    post = _create_post(client, ctx["auth"], caption="bye").json()["post"]
    r = client.delete(f"/api/posts/{post['id']}", headers=ctx["auth"])
    assert r.status_code == 200
    assert client.get(f"/api/posts/{post['id']}").status_code == 404
    # post count decreased
    me = client.get("/api/auth/me", headers=ctx["auth"]).json()["user"]
    assert me["posts"] == 0


def test_delete_other_users_post_forbidden(client, auth_headers):
    owner = auth_headers("delowner")["auth"]
    post = _create_post(client, owner, caption="mine").json()["post"]
    attacker = auth_headers("delattacker")["auth"]
    r = client.delete(f"/api/posts/{post['id']}", headers=attacker)
    assert r.status_code == 403
    # still exists
    assert client.get(f"/api/posts/{post['id']}").status_code == 200


def test_delete_requires_auth(client, auth_headers):
    ctx = auth_headers("delauth")
    post = _create_post(client, ctx["auth"], caption="x").json()["post"]
    assert client.delete(f"/api/posts/{post['id']}").status_code == 401


def test_pagination(client, auth_headers):
    ctx = auth_headers("paginator")
    for i in range(5):
        _create_post(client, ctx["auth"], caption=f"post {i}")
    r = client.get("/api/posts?offset=0&page_size=2")
    body = r.json()
    assert len(body["posts"]) == 2
    assert body["has_more"] is True
    r2 = client.get("/api/posts?offset=4&page_size=2")
    assert len(r2.json()["posts"]) == 1
    assert r2.json()["has_more"] is False


# ---- Media upload + location ----
def test_upload_post_image(client, auth_headers):
    import io

    h = auth_headers("postupload")
    files = {"file": ("test.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 1024), "image/png")}
    res = client.post("/api/posts/upload", files=files, headers=h["auth"])
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["media"]["type"] == "image"
    assert data["media"]["mimeType"] == "image/png"
    assert data["media"]["url"].startswith("/api/media/posts/")


def test_upload_post_video_preserves_mime(client, auth_headers):
    import io

    h = auth_headers("videoupload")
    files = {"file": ("test.mp4", io.BytesIO(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 1024), "video/mp4")}
    res = client.post("/api/posts/upload", files=files, headers=h["auth"])
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["media"]["type"] == "video"
    assert data["media"]["mimeType"] == "video/mp4"
    assert data["media"]["url"].startswith("/api/media/posts/")
    assert data["media"]["url"].endswith(".mp4")


def test_video_post_round_trip_stays_video(client, auth_headers):
    """A video post must remain a video (type + mimeType) after create + fetch."""
    import io

    h = auth_headers("videopost")
    files = {"file": ("clip.webm", io.BytesIO(b"\x1a\x45\xdf\xa3" + b"\x00" * 1024), "video/webm")}
    res = client.post("/api/posts/upload", files=files, headers=h["auth"])
    assert res.status_code == 200
    media = res.json()["media"]
    assert media["type"] == "video"
    assert media["mimeType"] == "video/webm"
    assert media["url"].endswith(".webm")

    payload_media = {"type": media["type"], "src": media["url"], "mimeType": media["mimeType"]}
    r = client.post(
        "/api/posts",
        json={"caption": "video post", "media": payload_media},
        headers=h["auth"],
    )
    assert r.status_code == 200
    post = r.json()["post"]
    assert post["media"]["type"] == "video"
    assert post["media"]["mimeType"] == "video/webm"
    assert post["media"]["src"] == media["url"]

    g = client.get(f"/api/posts/{post['id']}")
    assert g.status_code == 200
    fetched = g.json()["post"]
    assert fetched["media"]["type"] == "video"
    assert fetched["media"]["mimeType"] == "video/webm"


def test_upload_post_media_requires_auth(client):
    r = client.post("/api/posts/upload", files={"file": ("a.png", b"\x00" * 16, "image/png")})
    assert r.status_code in (401, 403)


def test_upload_post_rejects_invalid_type(client, auth_headers):
    import io

    h = auth_headers("postuploadbad")
    files = {"file": ("test.exe", io.BytesIO(b"bad"), "application/exe")}
    res = client.post("/api/posts/upload", files=files, headers=h["auth"])
    assert res.status_code in (400, 422)


def test_upload_post_rejects_data_url_src(client, auth_headers):
    """A base64 data URL must not be accepted as a media src."""
    h = auth_headers("postbase64")
    media = {"type": "image", "src": "data:image/png;base64," + "A" * 3000}
    r = client.post("/api/posts", json={"caption": "x", "media": media}, headers=h["auth"])
    assert r.status_code == 422
    msg = str(r.json().get("message") or r.json().get("detail") or "")
    assert "upload" in msg.lower()


def test_create_post_with_uploaded_media_and_location(client, auth_headers):
    import io

    h = auth_headers("postmedialoc")
    files = {"file": ("test.jpg", io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 1024), "image/jpeg")}
    res = client.post("/api/posts/upload", files=files, headers=h["auth"])
    assert res.status_code == 200
    url = res.json()["media"]["url"]

    r = client.post(
        "/api/posts",
        json={
            "caption": "BTS in Seoul",
            "hashtags": ["#BTS", "#ARMY"],
            "media": {"type": "image", "src": url},
            "location": "Seoul, South Korea",
        },
        headers=h["auth"],
    )
    assert r.status_code == 200
    post = r.json()["post"]
    assert post["media"]["src"] == url
    assert post["location"] == "Seoul, South Korea"
    assert post["hashtags"] == ["#BTS", "#ARMY"]


def test_create_post_without_media_and_music_publishes(client, auth_headers):
    """A text-only post with no music/media still publishes."""
    ctx = auth_headers("textpost")
    r = _create_post(client, ctx["auth"], caption="just a caption")
    assert r.status_code == 200
    post = r.json()["post"]
    assert post["text"] == "just a caption"
    assert post["media"]["src"] == ""
    assert post["music"] is None
    assert post["location"] == ""
