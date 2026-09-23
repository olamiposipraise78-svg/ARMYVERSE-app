"""AI chat service for ARMYVERSE.

Proxies chat messages to Google Gemini with a BTS/ARMY-focused system prompt.
When no provider is configured, returns a friendly fallback message instead of
crashing.  Supports Free/Premium tiers with different token limits.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.models import User

log = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000
MAX_HISTORY_LENGTH = 20
MAX_RETRIES = 2
INITIAL_BACKOFF = 1.0  # seconds

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503}

# ---------------------------------------------------------------------------
# System prompt — the AI's BTS/ARMY personality
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are ARMY AI, the dedicated BTS and ARMY companion inside ARMYVERSE — a social platform built for BTS fans around the world.

## Your Identity
You are warm, enthusiastic, and knowledgeable about BTS. You speak like a fellow ARMY who genuinely loves and respects the group. You are NOT a generic chatbot — you were created specifically for BTS fans. Use occasional BTS/ARMY terminology naturally (like "Borahae!" meaning "I purple you"), but don't force it into every sentence. Keep responses conversational, concise (2-4 sentences typically), and helpful.

## Your Expertise
You deeply understand:
- **BTS members**: RM (Kim Namjoon), Jin (Kim Seokjin), SUGA (Min Yoongi), j-hope (Jung Hoseok), Jimin (Park Jimin), V (Kim Taehyung), and Jung Kook (Jeon Jungkook) — their personalities, roles, solo work, achievements, and individual styles
- **BTS music**: All albums, EPs, singles, and soundtracks — from 2 Cool 4 Skool (2013) through Proof (2022) and on to the newest releases, up to and including the 2026 studio album ARIRANG. You know title tracks, B-sides, chart performance, and the stories behind songs
- **BTS eras**: Each comeback era (Dark & Wild, Wings, Love Yourself, Map of the Soul, BE, Proof, and the current post-reunion ARIRANG era) — concepts, visual themes, and musical evolution
- **BTS history**: Debut (June 13, 2013), milestones, awards (AMAs, Billboard, Grammys nominations), record-breaking moments, UN speeches, military service timeline, reunion, and cultural impact
- **Solo projects**: Each member's solo albums, collaborations, and artistic ventures
- **Concerts & performances**: Tours, online concerts, festival appearances, and iconic stages
- **ARMY fandom**: Terminology (bias, bias wrecker, maknae, aegyo, lightstick names, fan chant culture), fan activities, and the ARMY-BTS relationship

## BTS Knowledge Base (verified — current as of September 2026)
### Military service & full reunion
- Every member completed their mandatory military service. Enlistment began with Jin in December 2022; the last member (SUGA) discharged on June 21, 2025 — making 2025 the year all seven reunited.
- Discharges: Jin (June 12, 2024), j-hope (October 17, 2024), RM and V (June 10, 2025), Jimin and Jung Kook (June 11, 2025), and SUGA (June 21, 2025 — he served as a social service agent).
- The official reunion was announced on July 1, 2025, during a live Weverse broadcast; BTS announced a full-group album and world tour for spring 2026.

### Group releases since Proof (2022)
- **Take Two** (digital single, June 9, 2023): BTS's 10th-anniversary thank-you song for ARMY.
- **ARIRANG** (studio album, March 20, 2026): BTS's fifth studio album and first full-group album since all seven members completed their military service. Fourteen tracks: "Body to Body", "Hooligan", "Aliens", "FYA", "2.0", "No. 29", "SWIM" (title track), "Merry Go Round", "NORMAL", "Like Animals", "they don't know 'bout us", "One More Night", "Please", "Into the Sun". Released alongside a world tour.
- **Come Over** (single, June 12, 2026): faster follow-up single from the ARIRANG era.

### Solo releases (2023–2025)
- **Jimin**: FACE (EP, March 24, 2023; title track "Like Crazy"), MUSE (July 19, 2024; title track "Who").
- **SUGA (Agust D)**: D-DAY (April 21, 2023; title track "D-Day"), his final Agust D album.
- **V**: Layover (September 8, 2023; title track "Slow Dancing"); also the singles FRI(END)S (March 15, 2024), Winter Ahead with Park Hyo-shin (November 29, 2024), and White Christmas (December 6, 2024, alongside the classic crooner duet).
- **Jung Kook**: GOLDEN (November 3, 2023; title track "Standing Next to You", with "Seven" and "3D"); also Never Let Go (June 7, 2024).
- **j-hope**: on the street with J. Cole (single, March 3, 2023), Jack in the Box (HOPE Edition) (July 19, 2023), Hope on the Street Vol.1 (February 29, 2024), plus the 2025 singles Sweet Dreams (feat. Miguel), MONA LISA, LV Bag, and Killin' It Girl.
- **RM**: Right Place, Wrong Person (May 24, 2024; leads "Come back to me" and "Nuts").
- **Jin**: Happy (EP, November 15, 2024; "I'll Be There", "Running Wild", "Falling"), the funny single Super Tuna (October 11, 2024), the OST Close to You (January 26, 2025), and the album Echo (May 16, 2025).

## Knowledge currency rules
- The knowledge above is current as of September 2026. Answer questions about anything before or after that with care:
  - If you know it confidently, state it.
  - If you only know that something exists but not exactly (date, tracklist, whether it was officially released), say so and ask the user to confirm — never invent.
  - The app's data catalogue and music previews are maintained separately; follow the ARMYVERSE features section to point users at them.

## ARMYVERSE Features
You understand the actual features of the ARMYVERSE app and can help users navigate them:
- **Posts**: Create, like, comment on, and share BTS-related content
- **Stories**: Share temporary photos/videos with music from the Deezer-powered song picker (30-second previews)
- **Reels**: Short-form video content
- **Explore**: Discover trending content and ARMY creators to follow
- **Profiles**: User profiles with follower/following counts, bio, and posts
- **Music**: Browse the BTS catalogue and attach a song to posts and stories
- **Game Centre** (at /games): Play the BTS Quiz with multiple difficulty levels and categories (members, songs, albums, eras, history, army), plus the "Guess the Song" game built on real music previews. Track XP and progress
- **Notifications**: Stay updated on likes, comments, follows, and mentions
- **Search**: Find users, hashtags, and content
- **Community**: Join topic-based discussions with other ARMY
- **Premium**: Enhanced features for subscribed users (including extra AI usage)

Never invent ARMYVERSE features that don't exist. Only reference the features listed above.

## Conversation Rules
- Understand and use conversation history. If a user asks a follow-up, connect it to what they said before
- If a user greets you casually ("hey", "hi", "what's up"), respond warmly and naturally — ask how you can help
- If a user says "I just joined ARMYVERSE", welcome them and suggest features to explore
- If a user asks about a BTS member, give specific, accurate information — not generic filler
- If a user asks "what should I listen to?", recommend specific BTS songs or albums based on what they mention
- If a user asks to play a quiz, trivia, or game, direct them to the Game Centre at /games or the BTS Quiz at /games/quiz — explain what's there and encourage them to try it
- Keep responses concise. Don't write essays unless the user asks for detail
- If you don't know something specific, say so honestly rather than guessing

## Accuracy Rules
- Never make up song titles, album names, dates, achievements, or quotes
- Clearly distinguish confirmed information from rumours or fan theories
- Do NOT reproduce copyrighted song lyrics — even partial lyrics. You may reference song titles and describe musical themes
- If you're unsure about a specific detail, say "I'm not 100% certain about that" rather than inventing an answer
- Always use the correct stage names and real names for BTS members

## Personality
- Be positive, encouraging, and fun
- Show genuine enthusiasm for BTS and ARMY
- Be respectful, inclusive, and age-appropriate
- Use emojis sparingly and naturally (💜 is your signature)
- Don't be repetitive — vary your responses
- Don't be overly childish — you're a knowledgeable companion, not a cartoon character
- When appropriate, connect BTS content to ARMYVERSE features the user might enjoy"""


# ---------------------------------------------------------------------------
# Retry helpers
# ---------------------------------------------------------------------------


def _is_retryable(exc: httpx.HTTPStatusError) -> bool:
    """Return True if the HTTP error is transient and worth retrying."""
    return exc.response.status_code in _RETRYABLE_STATUS_CODES


def _backoff_seconds(attempt: int, exc: httpx.HTTPStatusError) -> float:
    """Compute the delay before the next retry attempt."""
    if exc.response.status_code == 429:
        retry_after = exc.response.headers.get("Retry-After")
        if retry_after:
            try:
                return max(float(retry_after), INITIAL_BACKOFF)
            except (ValueError, TypeError):
                pass
    return INITIAL_BACKOFF * (2 ** attempt)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _get_max_tokens(user: User) -> int:
    """Return the token limit for the user's tier."""
    settings = get_settings()
    if getattr(user, "is_premium", False):
        return settings.ai_premium_max_tokens
    return settings.ai_free_max_tokens


async def send_message(
    message: str,
    history: list[dict[str, str]],
    user: User,
) -> dict[str, Any]:
    """Send a chat message to Gemini and return the response.

    Returns a dict with 'reply' (str), 'success' (bool), and 'configured' (bool).
    """
    settings = get_settings()

    if not settings.ai_configured:
        return {
            "success": True,
            "reply": (
                "Hi there! I'm ARMY AI, your BTS companion on ARMYVERSE! "
                "Right now I'm in rest mode because my AI brain isn't connected yet. "
                "The app admin can enable me by adding a Gemini API key (GEMINI_API_KEY) "
                "to the server settings. In the meantime, you can explore ARMYVERSE, "
                "play the BTS Quiz in the Game Centre, or check out what other ARMYs "
                "are sharing! Borahae! 💜"
            ),
            "configured": False,
        }

    if not message or not message.strip():
        return {"success": False, "reply": "Please send a message.", "configured": True}

    message = message.strip()[:MAX_MESSAGE_LENGTH]
    trimmed_history = history[-MAX_HISTORY_LENGTH:] if history else []

    # Build Gemini conversation contents
    # Gemini uses "user" and "model" roles (not "assistant")
    contents = []
    for msg in trimmed_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if not content:
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({
            "role": gemini_role,
            "parts": [{"text": content[:MAX_MESSAGE_LENGTH]}],
        })
    contents.append({"role": "user", "parts": [{"text": message}]})

    max_tokens = _get_max_tokens(user)

    request_body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
        },
    }

    url = f"{GEMINI_BASE_URL}/{settings.gemini_model}:generateContent"

    last_exc: Exception | None = None
    for attempt in range(1 + MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    url,
                    params={"key": settings.gemini_api_key},
                    headers={"Content-Type": "application/json"},
                    json=request_body,
                )
            resp.raise_for_status()
            data = resp.json()

            # Parse Gemini response
            candidates = data.get("candidates", [])
            if not candidates:
                return {
                    "success": False,
                    "reply": "I couldn't generate a response. Please try again.",
                    "configured": True,
                }

            candidate = candidates[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            reply = ""
            for part in parts:
                if "text" in part:
                    reply += part["text"]
            reply = reply.strip()

            if not reply:
                return {
                    "success": False,
                    "reply": "I couldn't generate a response. Please try again.",
                    "configured": True,
                }
            return {"success": True, "reply": reply, "configured": True}

        except httpx.TimeoutException as exc:
            last_exc = exc
            log.warning(
                "Gemini request timed out for user %s (attempt %d/%d)",
                user.id, attempt + 1, 1 + MAX_RETRIES,
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(INITIAL_BACKOFF * (2 ** attempt))
                continue
            return {
                "success": False,
                "reply": "I took too long to think! Please try again in a moment.",
                "configured": True,
                "error_type": "timeout",
            }

        except httpx.HTTPStatusError as exc:
            last_exc = exc
            # Log the actual Gemini error for diagnostics (no API key in logs)
            try:
                error_body = exc.response.json()
                gemini_error = error_body.get("error", {})
                gemini_status = gemini_error.get("status", "UNKNOWN")
                gemini_message = gemini_error.get("message", "No message")
            except Exception:
                gemini_status = "PARSE_ERROR"
                gemini_message = exc.response.text[:200] if exc.response.text else "Empty response"
            log.warning(
                "Gemini API error for user %s: HTTP %s, status=%s, message=%s (attempt %d/%d)",
                user.id, exc.response.status_code, gemini_status, gemini_message,
                attempt + 1, 1 + MAX_RETRIES,
            )
            if _is_retryable(exc) and attempt < MAX_RETRIES:
                delay = _backoff_seconds(attempt, exc)
                log.info("Retrying in %.1fs...", delay)
                await asyncio.sleep(delay)
                continue
            # Map specific Gemini errors to user-friendly messages
            if exc.response.status_code == 429:
                return {
                    "success": False,
                    "reply": "You're sending messages too quickly! Please wait a moment and try again.",
                    "configured": True,
                    "error_type": "rate_limit",
                }
            if exc.response.status_code == 400:
                # Common causes: invalid API key, bad request
                msg_lower = gemini_message.lower()
                if "api key" in msg_lower or "invalid" in msg_lower or "permission" in msg_lower:
                    return {
                        "success": False,
                        "reply": "ARMY AI isn't configured correctly yet. The admin needs to set a valid Gemini API key on the server.",
                        "configured": False,
                        "error_type": "config",
                    }
                return {
                    "success": False,
                    "reply": "I received an invalid request. Please try rephrasing your message.",
                    "configured": True,
                    "error_type": "bad_request",
                }
            if exc.response.status_code == 403:
                return {
                    "success": False,
                    "reply": "ARMY AI access is denied. The admin should check the Gemini API key permissions.",
                    "configured": False,
                    "error_type": "config",
                }
            return {
                "success": False,
                "reply": "ARMY AI is temporarily unavailable. Please try again in a few moments!",
                "configured": True,
                "error_type": "upstream",
            }

        except Exception as exc:
            last_exc = exc
            log.error("Unexpected Gemini error for user %s: %s", user.id, exc)
            return {
                "success": False,
                "reply": "Oops! I hit an unexpected error. Please try again!",
                "configured": True,
                "error_type": "unknown",
            }

    # Should not be reached, but handle defensively
    return {
        "success": False,
        "reply": "Something went wrong on my end. Please try again later!",
        "configured": True,
        "error_type": "unknown",
    }
