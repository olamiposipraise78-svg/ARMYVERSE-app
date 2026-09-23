from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router
from app.api.routes.comments import router as comments_router
from app.api.routes.feed import router as feed_router
from app.api.routes.games import router as games_router
from app.api.routes.media import router as media_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.posts import router as posts_router
from app.api.routes.reels import router as reels_router
from app.api.routes.stories import router as stories_router
from app.api.routes.users import router as users_router

API_ROUTERS = [
    auth_router,
    users_router,
    posts_router,
    reels_router,
    comments_router,
    notifications_router,
    feed_router,
    stories_router,
    media_router,
    ai_router,
    games_router,
]
