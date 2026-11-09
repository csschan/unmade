from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agents, auth, projects, tasks, webhooks
from app.db.database import async_session, engine
from app.db.models import Base


async def _seed_demo():
    """Ensure demo users exist on startup."""
    import hashlib

    from app.db.models import User

    def hash_pw(pw: str) -> str:
        return hashlib.sha256(pw.encode()).hexdigest()

    async with async_session() as db:
        # Demo users
        users = [
            User(id="demo-business-001", email="business@unmade.demo", hashed_password=hash_pw("demo123"), role="business", display_name="FreshDash Logistics", paypal_email="sb-xh6iz39050757@business.example.com"),
            User(id="demo-contributor-001", email="alex@unmade.demo", hashed_password=hash_pw("demo123"), role="contributor", display_name="Alex Chen", paypal_email="sb-5y43434339921146@personal.example.com"),
            User(id="demo-contributor-002", email="sam@unmade.demo", hashed_password=hash_pw("demo123"), role="contributor", display_name="Sam Rodriguez", paypal_email="sb-c43a3f39138653@personal.example.com"),
            User(id="demo-contributor-003", email="jordan@unmade.demo", hashed_password=hash_pw("demo123"), role="contributor", display_name="Jordan Patel", paypal_email="sb-5y43434339921146@personal.example.com"),
        ]
        for u in users:
            if not await db.get(User, u.id):
                db.add(u)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_demo()
    yield


app = FastAPI(title="UNMADE", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "unmade"}
