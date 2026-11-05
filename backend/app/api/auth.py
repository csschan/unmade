from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.db.models import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "both"
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdatePayPalEmail(BaseModel):
    paypal_email: str


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.jwt_secret, algorithm=ALGORITHM)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    # In production, extract from Authorization header.
    # For hackathon demo, we accept user_id as query param too.
) -> User | None:
    return None


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        email=req.email,
        hashed_password=pwd_context.hash(req.password),
        role=req.role,
        display_name=req.display_name or req.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "email": user.email, "token": create_token(user.id)}


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"id": user.id, "email": user.email, "token": create_token(user.id)}


@router.put("/me/paypal")
async def update_paypal_email(
    req: UpdatePayPalEmail, user_id: str = "", db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.paypal_email = req.paypal_email
    await db.commit()
    return {"status": "updated"}
