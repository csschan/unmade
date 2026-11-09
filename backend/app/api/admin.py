import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Attribution, Product, Project, Submission, Task

router = APIRouter()

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class TaskInput(BaseModel):
    description: str
    target_contributor: str = ""
    location_hint: str = ""
    validation_criteria: str
    reward_usd: float = 10.0
    max_submissions: int = 5


class CreateAgentRequest(BaseModel):
    id: str | None = None
    agent_name: str
    mission: str
    budget_usd: float = 100.0
    analysis: dict = {}
    tasks: list[TaskInput] = []


# ---------------------------------------------------------------------------
# Demo seed data (moved from main.py)
# ---------------------------------------------------------------------------

DEMO_AGENTS = [
    {
        "id": "agent-london-delivery-001",
        "name": "London Delivery Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which London neighbourhoods have the worst delivery bottlenecks on weekday evenings, and why?",
        "budget": "100.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "London Delivery Intelligence Agent",
            "why_chatgpt_cannot_answer": "Real-time street-level congestion caused by temporary factors — new restaurants, construction diversions, market days — doesn't exist in any public dataset. Only people on the ground observe these compound effects.",
            "information_domains": ["delivery_courier", "rideshare_driver", "local_resident"],
            "estimated_contributors_needed": 3,
            "suggested_location": "East London",
        },
        "tasks": [
            ("agent-london-t1", "As a delivery courier in East London (Shoreditch, Bethnal Green, Hackney), document the top 3 streets where you consistently lose the most time on weekday evenings (6–9 PM). Include delay in minutes and what causes it.", "delivery_courier", "East London", "Must name specific streets. Must include delay times. Must describe a cause.", 25.00),
            ("agent-london-t2", "As a rideshare or taxi driver in Central/East London, describe traffic congestion patterns on weekday evenings. Which areas have gotten worse in the last 6 months? Include specific roads and time windows.", "rideshare_driver", "Central / East London", "Must mention specific road names. Must include time windows. Must indicate a pattern.", 20.00),
            ("agent-london-t3", "As a Shoreditch/Hoxton/Bethnal Green resident, describe recent changes affecting delivery traffic — new restaurants, construction, street closures, market days.", "local_resident", "Shoreditch / Hoxton / Bethnal Green", "Must be direct observation. Must describe a specific change. Must include approximate timeframe.", 15.00),
        ],
    },
    {
        "id": "agent-singapore-mrt-001",
        "name": "Singapore MRT Crowd Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which MRT stations and lines in Singapore are critically overcrowded during morning rush hour, and what hidden patterns explain it?",
        "budget": "80.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Singapore MRT Crowd Intelligence Agent",
            "why_chatgpt_cannot_answer": "Platform-level crowding patterns, train-skipping behaviour, and informal crowd management tactics used by commuters are not captured in any official data source.",
            "information_domains": ["daily_commuter", "station_staff_observer", "transport_blogger"],
            "estimated_contributors_needed": 4,
            "suggested_location": "Singapore",
        },
        "tasks": [
            ("agent-mrt-t1", "As a daily MRT commuter in Singapore, describe the worst crowding you experience regularly. Which station, which line, what time, and what do you think causes it? Have conditions changed recently?", "daily_commuter", "Singapore MRT Network", "Must name specific station and line. Must include time window. Must describe crowding severity.", 15.00),
            ("agent-mrt-t2", "If you commute via Jurong East, Dhoby Ghaut, or Raffles Place interchange, describe how transfer crowding has changed in the past year. Include specific platform observations and approximate waiting times.", "daily_commuter", "MRT Interchange Stations", "Must name the interchange. Must describe a change over time. Must include platform-level detail.", 18.00),
            ("agent-mrt-t3", "As someone who regularly observes MRT passenger behaviour, describe any informal patterns you've noticed — where commuters cluster, which doors they avoid, unofficial queuing norms that speed things up.", "transport_observer", "Singapore MRT", "Must describe a specific behavioural pattern. Must be first-hand observation. Must include station or line.", 12.00),
        ],
    },
    {
        "id": "agent-nyc-food-001",
        "name": "NYC Restaurant Pickup Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which NYC neighbourhoods have the longest and most unpredictable restaurant pickup wait times for delivery orders, and what causes the variance?",
        "budget": "120.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "NYC Restaurant Pickup Intelligence Agent",
            "why_chatgpt_cannot_answer": "Per-restaurant pickup time variance caused by kitchen workflow, ticket volume, and courier bunching is not tracked anywhere. The pattern is only visible to riders who wait at these locations daily.",
            "information_domains": ["food_delivery_rider", "restaurant_staff", "frequent_diner"],
            "estimated_contributors_needed": 4,
            "suggested_location": "New York City",
        },
        "tasks": [
            ("agent-nyc-t1", "As a food delivery rider in NYC (DoorDash, UberEats, Grubhub), name the 3 restaurants or neighbourhoods where you spend the most time waiting for orders. Include address, typical wait, and what you think causes it.", "food_delivery_rider", "New York City", "Must name specific restaurants or streets. Must include typical wait time. Must describe a cause.", 22.00),
            ("agent-nyc-t2", "If you work in or regularly observe a NYC restaurant kitchen during dinner service, describe how the ticket queue affects pickup wait times. When does it spike? What internal bottlenecks cause delays?", "restaurant_staff", "NYC Restaurant Kitchens", "Must describe a specific operational bottleneck. Must include time-of-day detail. Must be first-hand.", 20.00),
            ("agent-nyc-t3", "As a frequent delivery app user in NYC, describe the restaurants where your orders are most often delayed or cold on arrival. Include neighbourhood, typical delay, and time of day.", "frequent_diner", "New York City", "Must name specific restaurant or neighbourhood. Must include delay duration. Must indicate time of day.", 10.00),
        ],
    },
    {
        "id": "agent-toronto-cyclist-001",
        "name": "Toronto Cyclist Safety Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which Toronto intersections have the most unreported near-miss incidents for cyclists, and what infrastructure factors cause them?",
        "budget": "90.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Toronto Cyclist Safety Intelligence Agent",
            "why_chatgpt_cannot_answer": "Near-miss incidents are almost never reported officially. The pattern of dangerous intersections only exists in the collective memory of regular cyclists — it cannot be found in any government or traffic dataset.",
            "information_domains": ["daily_cyclist", "bike_courier", "cycling_advocate"],
            "estimated_contributors_needed": 3,
            "suggested_location": "Toronto",
        },
        "tasks": [
            ("agent-toronto-t1", "As a daily cyclist in Toronto, name the 3 intersections where you've experienced or witnessed the closest calls with vehicles. Include the intersection, what happened, and time of day.", "daily_cyclist", "Toronto", "Must name specific intersections. Must describe a near-miss incident. Must include time of day.", 20.00),
            ("agent-toronto-t2", "As a bike courier or frequent cyclist on Toronto's downtown grid, describe which streets have gotten more dangerous in the past 12 months and why — construction, new traffic patterns, removed infrastructure.", "bike_courier", "Toronto Downtown", "Must describe a specific change to road conditions. Must include street names. Must indicate a timeframe.", 25.00),
            ("agent-toronto-t3", "Have you noticed specific infrastructure failures at Toronto cycling infrastructure — badly placed bike lane endings, blind corners, painted lanes that disappear? Describe the most dangerous ones with exact locations.", "cycling_advocate", "Toronto Cycling Network", "Must describe a specific infrastructure problem. Must include exact location. Must explain why it creates danger.", 15.00),
        ],
    },
    {
        "id": "agent-sydney-rideshare-001",
        "name": "Sydney Rideshare Surge Intelligence Agent",
        "owner": "demo-business-001",
        "question": "When and where do rideshare surge prices in Sydney reach their highest levels, and what unreported local events drive the spikes?",
        "budget": "75.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Sydney Rideshare Surge Intelligence Agent",
            "why_chatgpt_cannot_answer": "Surge pricing is driven by hyper-local demand spikes from private events, venue closing times, and venue-specific crowd behaviour that never appears in public data or news.",
            "information_domains": ["rideshare_driver", "nightlife_regular", "event_worker"],
            "estimated_contributors_needed": 3,
            "suggested_location": "Sydney",
        },
        "tasks": [
            ("agent-sydney-t1", "As a Uber or Bolt driver in Sydney, describe the locations and times when you consistently see the highest surge multipliers. What events or patterns cause them? Include suburb names and approximate time windows.", "rideshare_driver", "Sydney", "Must name specific suburbs or venues. Must include time windows. Must describe a demand cause.", 18.00),
            ("agent-sydney-t2", "As someone who regularly goes out in Sydney (Kings Cross, Surry Hills, Newtown, CBD), describe the situations where you've been unable to get a rideshare or faced very high prices. Include location, time, and what was happening nearby.", "nightlife_regular", "Sydney Entertainment Districts", "Must include specific location. Must include time. Must describe nearby event or context.", 15.00),
            ("agent-sydney-t3", "If you work at or regularly attend events at Sydney venues (concerts, sports, festivals), describe what happens to rideshare availability and prices immediately after events end. Include venue name and typical patterns.", "event_worker", "Sydney Event Venues", "Must name a specific venue or event type. Must describe post-event rideshare behaviour. Must include timing.", 12.00),
        ],
    },
    {
        "id": "agent-tokyo-metro-001",
        "name": "Tokyo Metro Rush Hour Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which Tokyo Metro lines and transfer stations have the most severe overcrowding during morning rush hour, and what micro-behaviours do experienced commuters use to cope?",
        "budget": "95.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Tokyo Metro Rush Hour Intelligence Agent",
            "why_chatgpt_cannot_answer": "Unofficial platform-level tactics, unwritten queue rules, and carriage-specific crowd patterns in Tokyo are entirely passed by word of mouth among regular commuters — none exist in official data.",
            "information_domains": ["daily_commuter", "station_observer", "transport_researcher"],
            "estimated_contributors_needed": 4,
            "suggested_location": "Tokyo",
        },
        "tasks": [
            ("agent-tokyo-t1", "As a daily Tokyo Metro commuter, describe the worst crowding you experience. Which line, which station, which carriage position, and what time? Have conditions changed since any new developments nearby?", "daily_commuter", "Tokyo Metro Network", "Must name specific line and station. Must describe crowding level. Must include time window.", 22.00),
            ("agent-tokyo-t2", "Describe any unofficial tactics you or other Tokyo commuters use to avoid worst crowding — which carriage to board, which exit to use, which train to skip. Include specific station and line.", "daily_commuter", "Tokyo", "Must describe a specific tactic. Must name the station or line. Must be first-hand observation.", 20.00),
            ("agent-tokyo-t3", "If you regularly use Shinjuku, Shibuya, or Tokyo Station for transfers, describe which transfer corridors are most congested and at what time. Have any recent construction or events made it worse?", "station_observer", "Tokyo Major Hubs", "Must name specific transfer corridor or gate. Must include time window. Must describe congestion cause.", 18.00),
        ],
    },
    {
        "id": "agent-berlin-coworking-001",
        "name": "Berlin Coworking Space Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which Berlin neighbourhoods have the best density of affordable coworking spaces for freelancers, and what hidden quality differences do regular users notice?",
        "budget": "85.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Berlin Coworking Space Intelligence Agent",
            "why_chatgpt_cannot_answer": "Real Wi-Fi speeds, actual noise levels at different times, unwritten community norms, and which spaces have genuine networking value are only known by people who work there regularly.",
            "information_domains": ["freelancer", "remote_worker", "startup_founder"],
            "estimated_contributors_needed": 4,
            "suggested_location": "Berlin",
        },
        "tasks": [
            ("agent-berlin-t1", "As a freelancer or remote worker in Berlin, describe the coworking spaces you use or have tried. Which neighbourhood offers the best value? Include specific space names, monthly cost, and what makes it good or bad.", "freelancer", "Berlin", "Must name specific coworking space. Must include price range. Must describe quality factors.", 20.00),
            ("agent-berlin-t2", "Describe the real internet and noise conditions at Berlin coworking spaces you've used. Which spaces have reliable fast Wi-Fi? Which are too loud for calls? Include space name and neighbourhood.", "remote_worker", "Berlin", "Must name a specific space. Must describe Wi-Fi or noise conditions. Must include neighbourhood.", 18.00),
            ("agent-berlin-t3", "As someone who regularly uses coworking spaces in Mitte, Kreuzberg, Prenzlauer Berg, or Friedrichshain, describe which neighbourhoods have seen new spaces open or close recently and what trend you notice.", "startup_founder", "Berlin Neighbourhoods", "Must name specific neighbourhood. Must describe a recent change. Must include observation timeframe.", 15.00),
        ],
    },
    {
        "id": "agent-mumbai-street-food-001",
        "name": "Mumbai Street Food Hotspot Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which Mumbai street food clusters generate the highest foot traffic in the evening, and what unreported vendor patterns drive the best sales?",
        "budget": "70.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Mumbai Street Food Hotspot Intelligence Agent",
            "why_chatgpt_cannot_answer": "Real-time foot traffic at informal street food clusters, unofficial vendor scheduling, and word-of-mouth hotspots are entirely invisible to any mapping or commerce platform.",
            "information_domains": ["street_food_vendor", "daily_commuter", "food_blogger"],
            "estimated_contributors_needed": 3,
            "suggested_location": "Mumbai",
        },
        "tasks": [
            ("agent-mumbai-t1", "As someone who regularly eats street food in Mumbai, describe the clusters with the longest queues in the evening (6–10 PM). Which areas, which foods, and what time do queues peak? Include specific locality names.", "daily_commuter", "Mumbai", "Must name specific locality or street. Must include time window. Must describe queue or crowd behaviour.", 18.00),
            ("agent-mumbai-t2", "If you are or know a street food vendor in Mumbai, describe which locations and time slots generate the most sales. What makes certain spots outperform others — office crowd, train station proximity, event?", "street_food_vendor", "Mumbai", "Must describe a specific location pattern. Must include time window. Must give a reason for the pattern.", 20.00),
            ("agent-mumbai-t3", "Describe any Mumbai street food areas that have recently become more or less popular. Include the locality, what changed, and when you first noticed the shift.", "food_blogger", "Mumbai Localities", "Must name a specific locality. Must describe a change over time. Must include approximate timeframe.", 12.00),
        ],
    },
    {
        "id": "agent-amsterdam-tourist-001",
        "name": "Amsterdam Overtourism Intelligence Agent",
        "owner": "demo-business-001",
        "question": "Which Amsterdam neighbourhoods are most severely impacted by overtourism on weekends, and what specific friction points do residents and local businesses experience?",
        "budget": "88.00",
        "analysis": {
            "requires_ground_truth": True,
            "agent_name": "Amsterdam Overtourism Intelligence Agent",
            "why_chatgpt_cannot_answer": "Specific friction points — blocked doorways, noise at particular hours, impact on specific shops — are lived experiences that only residents and local workers can document. No tourism authority tracks this granularly.",
            "information_domains": ["local_resident", "local_business_owner", "frequent_visitor"],
            "estimated_contributors_needed": 4,
            "suggested_location": "Amsterdam",
        },
        "tasks": [
            ("agent-amsterdam-t1", "As an Amsterdam resident (Jordaan, De Pijp, Centrum, Oud-West), describe the worst overtourism impacts you experience on weekends. Include specific streets, times, and what type of tourist behaviour causes the most disruption.", "local_resident", "Amsterdam", "Must name specific street or neighbourhood. Must describe a specific behaviour. Must include time window.", 20.00),
            ("agent-amsterdam-t2", "If you run or work at a local Amsterdam business (cafe, shop, restaurant) in a tourist area, describe how weekend tourist crowds affect your operations. Which hours are worst? Has anything specific gotten worse recently?", "local_business_owner", "Amsterdam Tourist Areas", "Must describe a specific operational impact. Must include time-of-day detail. Must mention neighbourhood or street.", 22.00),
            ("agent-amsterdam-t3", "As someone who visits Amsterdam regularly from outside the city, describe which areas feel most overwhelmed by tourists and at what times. Which neighbourhoods do you now avoid and why?", "frequent_visitor", "Amsterdam", "Must name specific neighbourhood. Must describe crowd conditions. Must include time of day or week.", 16.00),
        ],
    },
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/agents", status_code=201)
async def create_agent(body: CreateAgentRequest, db: AsyncSession = Depends(get_db)):
    agent_id = body.id or str(uuid.uuid4())

    project = Project(
        id=agent_id,
        business_id="demo-business-001",
        question=body.mission,
        budget_usd=Decimal(str(body.budget_usd)),
        paypal_order_id=f"MOCK-ADMIN-{agent_id[:12]}",
        status="collecting",
        demand_analysis={"agent_name": body.agent_name, **body.analysis},
    )
    db.add(project)
    await db.flush()

    tasks_created = 0
    for t in body.tasks:
        task = Task(
            id=str(uuid.uuid4()),
            project_id=agent_id,
            description=t.description,
            target_contributor=t.target_contributor,
            location_hint=t.location_hint,
            validation_criteria=t.validation_criteria,
            reward_usd=Decimal(str(t.reward_usd)),
            max_submissions=t.max_submissions,
        )
        db.add(task)
        tasks_created += 1

    await db.commit()
    return {"agent_id": agent_id, "tasks_created": tasks_created}


@router.get("/agents")
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    projects = result.scalars().all()

    agents_out = []
    for p in projects:
        # task count
        task_result = await db.execute(
            select(func.count()).select_from(Task).where(Task.project_id == p.id)
        )
        task_count = task_result.scalar() or 0

        # submission count (via tasks)
        sub_result = await db.execute(
            select(func.count())
            .select_from(Submission)
            .join(Task, Submission.task_id == Task.id)
            .where(Task.project_id == p.id)
        )
        sub_count = sub_result.scalar() or 0

        analysis = p.demand_analysis or {}
        agents_out.append({
            "id": p.id,
            "name": analysis.get("agent_name", p.question[:60]),
            "status": p.status,
            "budget_usd": float(p.budget_usd),
            "task_count": task_count,
            "submission_count": sub_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return agents_out


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, agent_id)
    if not project:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 1. Find all tasks for this project
    task_result = await db.execute(select(Task).where(Task.project_id == agent_id))
    tasks = task_result.scalars().all()
    task_ids = [t.id for t in tasks]

    # 2. Find submissions for those tasks
    if task_ids:
        sub_result = await db.execute(
            select(Submission).where(Submission.task_id.in_(task_ids))
        )
        submissions = sub_result.scalars().all()
        sub_ids = [s.id for s in submissions]
    else:
        submissions = []
        sub_ids = []

    # 3. Find product for this project
    product_result = await db.execute(
        select(Product).where(Product.project_id == agent_id)
    )
    product = product_result.scalar_one_or_none()

    # 4. Delete attributions first
    if product:
        attr_result = await db.execute(
            select(Attribution).where(Attribution.product_id == product.id)
        )
        for attr in attr_result.scalars().all():
            await db.delete(attr)
        await db.flush()

    # 5. Delete product
    if product:
        await db.delete(product)
        await db.flush()

    # 6. Delete submissions
    for sub in submissions:
        await db.delete(sub)
    await db.flush()

    # 7. Delete tasks
    for task in tasks:
        await db.delete(task)
    await db.flush()

    # 8. Delete project
    await db.delete(project)
    await db.commit()


@router.post("/seed")
async def seed_demo_agents(db: AsyncSession = Depends(get_db)):
    created = 0
    skipped = 0

    for agent in DEMO_AGENTS:
        existing = await db.get(Project, agent["id"])
        if existing:
            skipped += 1
            continue

        db.add(Project(
            id=agent["id"],
            business_id=agent["owner"],
            question=agent["question"],
            budget_usd=Decimal(agent["budget"]),
            paypal_order_id=f"MOCK-WALLET-{agent['id'][:12]}",
            status="collecting",
            demand_analysis=agent["analysis"],
        ))
        await db.flush()

        for tid, desc, role, loc, criteria, reward in agent["tasks"]:
            if not await db.get(Task, tid):
                db.add(Task(
                    id=tid,
                    project_id=agent["id"],
                    description=desc,
                    target_contributor=role,
                    location_hint=loc,
                    validation_criteria=criteria,
                    reward_usd=Decimal(str(reward)),
                    max_submissions=5,
                ))

        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped}
