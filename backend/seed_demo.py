"""Seed the database with demo users, project, and tasks for the hackathon demo."""

import asyncio
import hashlib
from decimal import Decimal

from app.db.database import async_session, engine
from app.db.models import Base, Project, Task, User


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


DEMO_PROJECT_ID = "demo-project-london-001"

DEMO_TASKS = [
    {
        "id": "demo-task-courier-001",
        "description": "As a delivery courier operating in East London (Shoreditch, Bethnal Green, Hackney), document the top 3 streets or junctions where you consistently lose the most time on weekday evenings (6–9 PM). Include approximate delay in minutes and what you think causes it.",
        "target_contributor": "delivery_courier",
        "location_hint": "East London (Shoreditch / Bethnal Green)",
        "validation_criteria": "Must name specific streets or junctions. Must include estimated delay times. Must describe a cause (construction, market, restaurant pickups, etc.).",
        "reward_usd": 25.00,
        "max_submissions": 3,
    },
    {
        "id": "demo-task-driver-001",
        "description": "As a rideshare or taxi driver in Central/East London, describe patterns you've noticed in traffic congestion on weekday evenings. Which areas have gotten noticeably worse in the last 6 months? Include specific roads and approximate time windows.",
        "target_contributor": "rideshare_driver",
        "location_hint": "Central / East London",
        "validation_criteria": "Must mention specific road names. Must include time windows. Must indicate a noticeable change or pattern — not just general traffic complaints.",
        "reward_usd": 20.00,
        "max_submissions": 3,
    },
    {
        "id": "demo-task-resident-001",
        "description": "As a resident of Shoreditch, Hoxton, or Bethnal Green, describe any recent changes to your neighbourhood that you think affect delivery traffic or congestion — new restaurants opening, construction projects, street closures, market days, etc.",
        "target_contributor": "local_resident",
        "location_hint": "Shoreditch / Hoxton / Bethnal Green",
        "validation_criteria": "Must be based on direct observation, not news articles. Must describe a specific change (not just 'it's gotten busier'). Must mention approximate timeframe.",
        "reward_usd": 15.00,
        "max_submissions": 3,
    },
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # --- Users ---
        users = [
            User(
                id="demo-business-001",
                email="business@unmade.demo",
                hashed_password=hash_pw("demo123"),
                role="business",
                display_name="FreshDash Logistics",
                paypal_email="sb-xh6iz39050757@business.example.com",
            ),
            User(
                id="demo-contributor-001",
                email="alex@unmade.demo",
                hashed_password=hash_pw("demo123"),
                role="contributor",
                display_name="Alex Chen",
                paypal_email="sb-5y43434339921146@personal.example.com",
            ),
            User(
                id="demo-contributor-002",
                email="sam@unmade.demo",
                hashed_password=hash_pw("demo123"),
                role="contributor",
                display_name="Sam Rodriguez",
                paypal_email="sb-c43a3f39138653@personal.example.com",
            ),
            User(
                id="demo-contributor-003",
                email="jordan@unmade.demo",
                hashed_password=hash_pw("demo123"),
                role="contributor",
                display_name="Jordan Patel",
                paypal_email="sb-5y43434339921146@personal.example.com",
            ),
        ]

        for user in users:
            existing = await db.get(User, user.id)
            if not existing:
                db.add(user)
                print(f"  ✓ Created user: {user.display_name} ({user.id})")
            else:
                print(f"  · Exists: {user.display_name}")

        await db.flush()

        # --- Demo Project ---
        existing_proj = await db.get(Project, DEMO_PROJECT_ID)
        if not existing_proj:
            project = Project(
                id=DEMO_PROJECT_ID,
                business_id="demo-business-001",
                question="Which London neighbourhoods have the worst delivery bottlenecks on weekday evenings, and what is causing them?",
                budget_usd=Decimal("100.00"),
                paypal_order_id=f"MOCK-ORDER-{DEMO_PROJECT_ID[:8]}",
                status="collecting",
                demand_analysis={
                    "requires_ground_truth": True,
                    "why_chatgpt_cannot_answer": "Real-time street-level congestion patterns caused by temporary factors (new restaurants, construction diversion, market days) are not in any public dataset. Only people on the ground observe these compound effects.",
                    "information_domains": ["delivery_courier", "rideshare_driver", "local_resident"],
                    "estimated_contributors_needed": 3,
                },
            )
            db.add(project)
            print(f"\n  ✓ Created project: {DEMO_PROJECT_ID}")
        else:
            print(f"\n  · Exists: project {DEMO_PROJECT_ID}")

        await db.flush()

        # --- Demo Tasks ---
        for t in DEMO_TASKS:
            existing_task = await db.get(Task, t["id"])
            if not existing_task:
                task = Task(
                    id=t["id"],
                    project_id=DEMO_PROJECT_ID,
                    description=t["description"],
                    target_contributor=t["target_contributor"],
                    location_hint=t["location_hint"],
                    validation_criteria=t["validation_criteria"],
                    reward_usd=Decimal(str(t["reward_usd"])),
                    max_submissions=t["max_submissions"],
                    accepted_count=0,
                    status="open",
                )
                db.add(task)
                print(f"  ✓ Created task: {t['id']}")
            else:
                print(f"  · Exists: task {t['id']}")

        await db.commit()

    print("\n✅ Demo seed complete!")
    print("\nPersonas:")
    print("  🏢  FreshDash Logistics     demo-business-001")
    print("  🛵  Alex Chen (Courier)     demo-contributor-001")
    print("  🚕  Sam Rodriguez (Driver)  demo-contributor-002")
    print("  🏠  Jordan Patel (Resident) demo-contributor-003")
    print(f"\nDemo project: {DEMO_PROJECT_ID}")
    print("  → 3 open tasks ready for submission on /earn")


if __name__ == "__main__":
    asyncio.run(seed())
