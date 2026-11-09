"""
Agents API — enterprises deploy funded AI agents that run autonomously.

Flow:
  POST /agents              → validate mission + create agent + PayPal order (wallet funded)
  POST /agents/{id}/activate → after PayPal approval: decompose mission, start collecting
  GET  /agents/{id}          → agent dashboard (budget, tasks, findings)
  POST /agents/{id}/think    → trigger reasoning cycle (fuse + watchdog)
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Attribution, Product, Project, Submission, Task, User
from app.services import demand_analyzer, paypal_service, task_decomposer

router = APIRouter()


class DeployAgentRequest(BaseModel):
    agent_name: str
    mission: str
    budget_usd: float
    business_id: str = "demo-business-001"


@router.post("")
async def deploy_agent(
    req: DeployAgentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: Validate mission + create agent + create PayPal order for the wallet.
    Returns order_id — frontend shows PayPal button.
    Agent starts collecting only after payment is confirmed (/activate).
    """
    from app.config import settings as cfg

    # Demand analysis — verify this needs real people
    analysis = await demand_analyzer.analyze_demand(req.mission, req.budget_usd)

    if not analysis.get("requires_ground_truth"):
        return {
            "status": "rejected",
            "reason": analysis.get("rejection_reason", "This can be answered with public data."),
        }

    # Embed agent name into analysis JSON (no schema migration needed)
    analysis["agent_name"] = req.agent_name

    # Create project (agent = project internally), status=draft until funded
    project = Project(
        business_id=req.business_id,
        question=req.mission,
        budget_usd=Decimal(str(req.budget_usd)),
        status="draft",
        demand_analysis=analysis,
    )
    db.add(project)
    await db.flush()

    # Create PayPal order to fund the agent wallet
    if cfg.mock_paypal:
        order_id = f"MOCK-AGENT-{project.id[:8]}"
        approve_url = "mock://approved"
    else:
        order = await paypal_service.create_order(
            amount_usd=str(req.budget_usd),
            description=f"UNMADE Agent Wallet: {req.agent_name[:80]}",
        )
        order_id = order["id"]
        approve_url = next(
            (link["href"] for link in order.get("links", []) if link["rel"] == "approve"), ""
        )

    project.paypal_order_id = order_id
    await db.commit()

    return {
        "status": "awaiting_payment",
        "agent_id": project.id,
        "agent_name": req.agent_name,
        "order_id": order_id,
        "approve_url": approve_url,
        "budget_usd": req.budget_usd,
        "analysis": analysis,
    }


@router.post("/{agent_id}/activate")
async def activate_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """
    Step 2: Called after PayPal payment approved.
    Captures payment, decomposes mission into tasks, sets agent to collecting.
    """
    from app.config import settings as cfg

    result = await db.execute(select(Project).where(Project.id == agent_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Agent not found")
    if project.status != "draft":
        raise HTTPException(400, "Agent already activated")

    # Capture PayPal payment
    if not cfg.mock_paypal:
        capture = await paypal_service.capture_order(project.paypal_order_id)
        if capture.get("status") != "COMPLETED":
            raise HTTPException(400, f"Payment capture failed: {capture.get('status')}")

    # Decompose mission into tasks — agent starts collecting
    analysis = project.demand_analysis or {}
    decomposition = await task_decomposer.decompose(
        question=project.question,
        domains=analysis.get("information_domains", []),
        budget=float(project.budget_usd),
        contributors_needed=analysis.get("estimated_contributors_needed", 5),
    )

    tasks_created = 0
    for t in decomposition.get("tasks", []):
        task = Task(
            project_id=project.id,
            description=t["description"],
            target_contributor=t.get("target_contributor"),
            location_hint=t.get("location_hint"),
            validation_criteria=t["validation_criteria"],
            reward_usd=Decimal(str(t.get("reward_per_submission", 2.0))),
            max_submissions=t.get("max_submissions", 10),
        )
        db.add(task)
        tasks_created += 1

    project.status = "collecting"
    await db.commit()

    return {
        "status": "collecting",
        "agent_id": project.id,
        "tasks_created": tasks_created,
    }


@router.get("/transactions/all")
async def list_transactions(db: AsyncSession = Depends(get_db)):
    """All payout transactions across every agent — for the Payouts page."""
    projects = (await db.execute(
        select(Project).options(selectinload(Project.tasks))
    )).scalars().all()

    records = []
    for proj in projects:
        prod_result = await db.execute(
            select(Product).options(selectinload(Product.attributions))
            .where(Product.project_id == proj.id)
        )
        product = prod_result.scalar_one_or_none()
        if not product or not product.attributions:
            continue

        analysis = proj.demand_analysis or {}
        for attr in product.attributions:
            user = (await db.execute(
                select(User).where(User.id == attr.contributor_id)
            )).scalar_one_or_none()
            records.append({
                "agent_id": proj.id,
                "agent_name": analysis.get("agent_name", proj.question[:50]),
                "contributor_id": attr.contributor_id,
                "contributor_name": user.display_name if user else attr.contributor_id[-8:],
                "paypal_email": user.paypal_email if user else None,
                "payout_usd": float(attr.payout_usd),
                "marginal_contribution": attr.marginal_contribution,
                "reason": attr.reason,
                "payout_status": attr.status,
                "paid_at": product.created_at.isoformat() if product.created_at else None,
            })

    total_paid = sum(r["payout_usd"] for r in records if r["payout_status"] in ("sent", "completed"))
    return {
        "transactions": records,
        "summary": {
            "total_transactions": len(records),
            "total_paid_usd": round(total_paid, 2),
            "agents_completed": len({r["agent_id"] for r in records}),
        },
    }


@router.get("/{agent_id}")
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Agent dashboard: budget meter, tasks, findings, activity."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.tasks))
        .where(Project.id == agent_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Agent not found")

    analysis = project.demand_analysis or {}
    agent_name = analysis.get("agent_name", "AI Agent")

    # Budget spent = rewards owed for all accepted submissions
    task_ids = [t.id for t in project.tasks]
    sub_result = await db.execute(
        select(Submission).where(
            Submission.task_id.in_(task_ids),
            Submission.status == "accepted",
        )
    )
    accepted_subs = sub_result.scalars().all()
    task_map = {t.id: t for t in project.tasks}
    budget_spent = sum(float(task_map[s.task_id].reward_usd) for s in accepted_subs)

    # Detailed task list with submission counts
    tasks_data = []
    for t in project.tasks:
        all_subs_result = await db.execute(
            select(Submission).where(Submission.task_id == t.id)
        )
        all_subs = all_subs_result.scalars().all()
        tasks_data.append(
            {
                "id": t.id,
                "description": t.description,
                "target_contributor": t.target_contributor,
                "location_hint": t.location_hint,
                "reward_usd": float(t.reward_usd),
                "accepted_count": t.accepted_count,
                "total_submissions": len(all_subs),
                "status": t.status,
                "is_help_task": t.description.startswith("[AI Help Request]"),
            }
        )

    # Current findings from product if already fused
    prod_result = await db.execute(
        select(Product)
        .options(selectinload(Product.attributions))
        .where(Product.project_id == agent_id)
    )
    product = prod_result.scalar_one_or_none()

    findings = []
    confidence = None
    attributions = []
    if product:
        findings = product.findings or []
        meta = product.fusion_metadata or {}
        confidence = meta.get("data_quality", {}).get("overall_confidence")
        attributions = [
            {
                "contributor_id": a.contributor_id,
                "marginal_contribution": a.marginal_contribution,
                "payout_usd": float(a.payout_usd),
                "reason": a.reason,
                "payout_status": a.status,  # pending / sent / completed / failed
            }
            for a in product.attributions
        ]

    # Accepted observations — shown on dashboard while still collecting
    observations = []
    if project.status == "collecting":
        for s in accepted_subs:
            user = (await db.execute(select(User).where(User.id == s.contributor_id))).scalar_one_or_none()
            observations.append({
                "contributor_name": user.display_name if user else s.contributor_id[-8:],
                "task_description": task_map[s.task_id].description[:80] + "..." if s.task_id in task_map else "",
                "content": s.content,
            })

    total = float(project.budget_usd)
    return {
        "id": project.id,
        "agent_name": agent_name,
        "mission": project.question,
        "status": project.status,
        "budget_total": total,
        "budget_spent": round(budget_spent, 2),
        "budget_remaining": round(total - budget_spent, 2),
        "tasks": tasks_data,
        "findings": findings,
        "confidence": confidence,
        "attributions": attributions,
        "observations": observations,
        "analysis": analysis,
    }


@router.post("/{agent_id}/think")
async def agent_think(agent_id: str, db: AsyncSession = Depends(get_db)):
    """
    Trigger agent reasoning cycle:
    1. Fuse all accepted submissions into findings
    2. Run watchdog — post help tasks for any gaps
    Returns updated findings + any new help tasks posted.
    """
    from app.api.projects import _do_fuse

    try:
        fuse_result = await _do_fuse(agent_id, db)
    except HTTPException as e:
        # Not enough data yet — run watchdog anyway to post help tasks
        from app.services.agent_watchdog import check_and_help_no_submissions
        from sqlalchemy import select as sa_select
        from app.db.models import Project as ProjectModel

        async with db.begin_nested():
            r = await db.execute(sa_select(ProjectModel).where(ProjectModel.id == agent_id))
            project = r.scalar_one_or_none()
            if project:
                help_tasks = await check_and_help_no_submissions(db=db, project=project)
                await db.commit()
                return {
                    "status": "not_enough_data",
                    "detail": e.detail,
                    "help_tasks_posted": [
                        {"id": ht.id, "description": ht.description[:100], "reward_usd": float(ht.reward_usd)}
                        for ht in help_tasks
                    ],
                }
        return {"status": "not_enough_data", "detail": e.detail}

    # Auto-payout contributors from agent wallet after successful fusion
    payout_result = await _agent_payout(agent_id, db)

    return {
        "status": "thought",
        "findings_count": fuse_result.get("findings_count"),
        "confidence": fuse_result.get("confidence"),
        "agent_help_task": fuse_result.get("agent_help_task"),
        "payout": payout_result,
    }


async def _agent_payout(agent_id: str, db: AsyncSession) -> dict:
    """Execute PayPal payouts to contributors after fusion."""
    from app.config import settings as cfg
    from app.db.models import Attribution, Product, User
    from decimal import Decimal

    prod_result = await db.execute(
        select(Product).options(selectinload(Product.attributions)).where(Product.project_id == agent_id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        return {"status": "skipped", "reason": "no product"}

    # Only pay attributions that are still pending
    pending = [a for a in product.attributions if a.status == "pending"]
    if not pending:
        return {"status": "skipped", "reason": "already paid"}

    payout_items = []
    for attr in pending:
        user_result = await db.execute(select(User).where(User.id == attr.contributor_id))
        user = user_result.scalar_one_or_none()
        if user and user.paypal_email:
            payout_items.append({
                "email": user.paypal_email,
                "amount": str(attr.payout_usd),
                "note": f"UNMADE agent earnings",
                "_attr_id": attr.id,
            })

    if not payout_items:
        return {"status": "skipped", "reason": "no paypal emails"}

    if cfg.mock_paypal:
        batch_id = f"ua_{agent_id[:12]}"
        for item in payout_items:
            attr_result = await db.execute(select(Attribution).where(Attribution.id == item["_attr_id"]))
            attr = attr_result.scalar_one_or_none()
            if attr:
                attr.status = "completed"
        await db.commit()
        return {
            "status": "SUCCESS",
            "batch_id": batch_id,
            "paid_count": len(payout_items),
            "total_paid": sum(float(i["amount"]) for i in payout_items),
        }
    else:
        try:
            result = await paypal_service.create_payout(
                batch_id=f"ua_{agent_id[:12]}",
                items=[{k: v for k, v in i.items() if k != "_attr_id"} for i in payout_items],
            )
            for item in payout_items:
                attr_result = await db.execute(select(Attribution).where(Attribution.id == item["_attr_id"]))
                attr = attr_result.scalar_one_or_none()
                if attr:
                    attr.status = "sent"
            await db.commit()
            return {"status": "SUCCESS", "batch_id": result.get("batch_header", {}).get("payout_batch_id"), "paid_count": len(payout_items)}
        except Exception as e:
            return {"status": "FAILED", "error": str(e)}
