"""Seed the database with demo users for the hackathon demo."""

import asyncio

from app.db.database import async_session, engine
from app.db.models import Base, User


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

        users = [
            User(
                id="demo-business-001",
                email="business@unmade.demo",
                hashed_password=pwd.hash("demo123"),
                role="business",
                display_name="Demo Logistics Co",
                paypal_email="sb-business@paypal.com",
            ),
            User(
                id="demo-contributor-001",
                email="courier@unmade.demo",
                hashed_password=pwd.hash("demo123"),
                role="contributor",
                display_name="Alex (Courier)",
                paypal_email="sb-courier@paypal.com",
            ),
            User(
                id="demo-contributor-002",
                email="driver@unmade.demo",
                hashed_password=pwd.hash("demo123"),
                role="contributor",
                display_name="Sam (Driver)",
                paypal_email="sb-driver@paypal.com",
            ),
            User(
                id="demo-contributor-003",
                email="resident@unmade.demo",
                hashed_password=pwd.hash("demo123"),
                role="contributor",
                display_name="Jordan (Resident)",
                paypal_email="sb-resident@paypal.com",
            ),
        ]

        for user in users:
            existing = await db.get(User, user.id)
            if not existing:
                db.add(user)
                print(f"  Created user: {user.display_name} ({user.id})")
            else:
                print(f"  Already exists: {user.display_name}")

        await db.commit()
        print("\nDemo users seeded successfully!")
        print("\nBusiness user:    demo-business-001")
        print("Contributors:     demo-contributor-001, 002, 003")


if __name__ == "__main__":
    asyncio.run(seed())
