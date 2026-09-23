"""Centralised application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed, validated application settings sourced from environment/.env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Astra DB ---
    astra_db_api_endpoint: str = ""
    astra_db_application_token: str = ""
    astra_db_namespace: str = ""
    astra_db_keyspace: str = ""

    # --- JWT ---
    jwt_access_secret: str = "dev-only-access-secret-please-change"
    jwt_refresh_secret: str = "dev-only-refresh-secret-please-change"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_seconds: int = 900
    jwt_refresh_token_expire_seconds: int = 2592000

    # --- App ---
    frontend_url: str = "http://localhost:5173"
    port: int = 8000

    # --- Rate limiting (requests per minute) ---
    # Enforcement is controlled by slowapi's RATELIMIT_ENABLED env var
    # (set RATELIMIT_ENABLED=false to disable during tests/local dev).
    rate_limit_login_per_min: int = 5
    rate_limit_register_per_min: int = 3
    rate_limit_refresh_per_min: int = 10
    rate_limit_comment_per_min: int = 20
    rate_limit_create_post_per_min: int = 10
    rate_limit_reply_per_min: int = 30
    rate_limit_ai_per_min: int = 10
    rate_limit_default_per_min: int = 120

    # --- Pagination ---
    page_size_default: int = 20
    page_size_max: int = 50

    # --- Spotify API (Client Credentials) ---
    spotify_client_id: str = ""
    spotify_client_secret: str = ""

    # --- Cloudflare R2 (S3-compatible object storage for media) ---
    # When all five are present, uploads go to R2 and return public URLs.
    # Otherwise the app falls back to local disk storage (development/tests).
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_base_url: str = ""

    # --- Stories ---
    # Time (in hours) a story remains active before it expires and stops
    # appearing in active-story queries and interactions.
    story_ttl_hours: int = 24

    # --- AI Provider (Google Gemini) ---
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    ai_max_tokens: int = 500

    # --- AI Free / Premium tiers ---
    ai_free_max_tokens: int = 1024
    ai_premium_max_tokens: int = 1000
    ai_free_rate_limit: int = 5
    ai_premium_rate_limit: int = 20

    @property
    def r2_configured(self) -> bool:
        """True when Cloudflare R2 credentials are present for media uploads."""
        return bool(
            self.r2_account_id
            and self.r2_access_key_id
            and self.r2_secret_access_key
            and self.r2_bucket_name
            and self.r2_public_base_url
        )

    @property
    def astra_configured(self) -> bool:
        """True when real Astra DB credentials are present."""
        return bool(
            self.astra_db_api_endpoint and self.astra_db_application_token
        )

    @property
    def ai_configured(self) -> bool:
        """True when a Gemini API key is available."""
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
