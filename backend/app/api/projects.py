from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Attribution, Product, Project, Submission, Task, User
from app.services import (
    demand_analyzer,
    fusion_engine,
    paypal_service,
    task_decomposer,
    value_attribution,
)

router = APIRouter()


class CreateProjectRequest(BaseModel):
    question: str
    budget_usd: float


class FundResponse(BaseModel):
    order_id: str
    approve_url: str


# --- Discover side endpoints ---


@router.post("")
async def create_project(
    req: CreateProjectRequest,
    user_id: str = Query(..., description="Business user ID"),
    db: AsyncSession = Depends(get_db),
):
    """Submit a question + budget. Runs Demand Analyzer."""
    # Validate user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    # Run demand analysis
    analysis = await demand_analyzer.analyze_demand(req.question, req.budget_usd)

    if not analysis.get("requires_ground_truth"):
        return {
            "status": "rejected",
            "reason": analysis.get("rejection_reason", "This question can be answered with public data."),
            "analysis": analysis,
        }

    # Create project
    project = Project(
        business_id=user_id,
        question=req.question,
        budget_usd=Decimal(str(req.budget_usd)),
        status="draft",
        demand_analysis=analysis,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return {
        "status": "created",
        "project": {
            "id": project.id,
            "question": project.question,
            "budget_usd": float(project.budget_usd),
            "status": project.status,
            "analysis": analysis,
        },
    }


@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.tasks)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    tasks_data = [
        {
            "id": t.id,
            "description": t.description,
            "target_contributor": t.target_contributor,
            "location_hint": t.location_hint,
            "reward_usd": float(t.reward_usd),
            "max_submissions": t.max_submissions,
            "accepted_count": t.accepted_count,
            "status": t.status,
        }
        for t in project.tasks
    ]

    return {
        "id": project.id,
        "question": project.question,
        "budget_usd": float(project.budget_usd),
        "status": project.status,
        "analysis": project.demand_analysis,
        "tasks": tasks_data,
    }


@router.post("/{project_id}/fund")
async def fund_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Create PayPal order to hold budget."""
    from app.config import settings as cfg

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    if cfg.mock_paypal:
        project.paypal_order_id = f"MOCK-ORDER-{project.id[:8]}"
        await db.commit()
        return {"order_id": project.paypal_order_id, "approve_url": "mock://approved"}

    order = await paypal_service.create_order(
        amount_usd=str(project.budget_usd),
        description=f"UNMADE Intelligence: {project.question[:100]}",
    )

    project.paypal_order_id = order["id"]
    await db.commit()

    approve_url = next(
        (link["href"] for link in order.get("links", []) if link["rel"] == "approve"), ""
    )

    return {"order_id": order["id"], "approve_url": approve_url}


@router.post("/{project_id}/fund/capture")
async def capture_funding(project_id: str, db: AsyncSession = Depends(get_db)):
    """Capture payment after buyer approves. Triggers task decomposition."""
    from app.config import settings as cfg

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project or not project.paypal_order_id:
        raise HTTPException(400, "Project not funded or not found")

    if not cfg.mock_paypal:
        capture = await paypal_service.capture_order(project.paypal_order_id)
        capture_status = capture.get("status", "")
        if capture_status != "COMPLETED":
            raise HTTPException(400, f"Payment capture failed: {capture_status}")

    # Decompose into tasks
    analysis = project.demand_analysis or {}
    decomposition = await task_decomposer.decompose(
        question=project.question,
        domains=analysis.get("information_domains", []),
        budget=float(project.budget_usd),
        contributors_needed=analysis.get("estimated_contributors_needed", 5),
    )

    # Create task records
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

    project.status = "collecting"
    await db.commit()

    return {"status": "collecting", "tasks_created": len(decomposition.get("tasks", []))}


@router.get("/{project_id}/product")
async def get_product(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get the fused intelligence product."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.attributions))
        .where(Product.project_id == project_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not ready yet")

    attributions_data = [
        {
            "contributor_id": a.contributor_id,
            "marginal_contribution": a.marginal_contribution,
            "reason": a.reason,
            "payout_usd": float(a.payout_usd),
            "status": a.status,
        }
        for a in product.attributions
    ]

    return {
        "id": product.id,
        "title": product.title,
        "summary": product.summary,
        "findings": product.findings,
        "fusion_metadata": product.fusion_metadata,
        "attributions": attributions_data,
    }


@router.post("/{project_id}/fuse")
async def trigger_fusion(project_id: str, db: AsyncSession = Depends(get_db)):
    """Run fusion engine on all accepted submissions."""
    import traceback as _tb
    try:
        return await _do_fuse(project_id, db)
    except HTTPException:
        raise
    except Exception as e:
        _tb.print_exc()
        # Watchdog: auto-post help task on fusion failure
        try:
            from app.services.agent_watchdog import create_help_task
            result = await db.execute(select(Project).where(Project.id == project_id))
            project = result.scalar_one_or_none()
            if project:
                help_task = await create_help_task(
                    db=db, project=project,
                    issue_type="fusion_error",
                    context={"question": project.question, "error": str(e)[:200]},
                )
                await db.commit()
                raise HTTPException(500, f"Fusion failed — agent posted help task {help_task.id}: {e}")
        except HTTPException:
            raise
        except Exception:
            pass
        raise HTTPException(500, f"Fusion failed: {e}")


async def _do_fuse(project_id: str, db: AsyncSession):
    result = await db.execute(
        select(Project).options(selectinload(Project.tasks)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Gather all accepted submissions
    task_ids = [t.id for t in project.tasks]
    sub_result = await db.execute(
        select(Submission)
        .where(Submission.task_id.in_(task_ids), Submission.status == "accepted")
    )
    submissions = sub_result.scalars().all()

    if len(submissions) < 2:
        raise HTTPException(400, "Need at least 2 accepted submissions to fuse")

    # Build submission data with task context
    task_map = {t.id: t for t in project.tasks}
    sub_data = [
        {
            "id": s.id,
            "content": s.content,
            "contributor_type": task_map[s.task_id].target_contributor,
            "task_description": task_map[s.task_id].description,
        }
        for s in submissions
    ]

    # Run fusion
    project.status = "fusing"
    await db.commit()

    fusion_result = await fusion_engine.fuse(project.question, sub_data)

    # Create product
    product = Product(
        project_id=project.id,
        title=fusion_result.get("title", "Intelligence Report"),
        summary=fusion_result.get("summary", ""),
        findings=fusion_result.get("findings", []),
        fusion_metadata={
            "correlations": fusion_result.get("correlations_discovered", []),
            "data_quality": fusion_result.get("data_quality", {}),
            "limitations": fusion_result.get("limitations", []),
        },
    )
    db.add(product)
    await db.flush()  # Ensure product.id is set before creating attributions

    # Compute attribution
    contributors_map: dict[str, list[dict]] = {}
    for s in submissions:
        cid = s.contributor_id
        if cid not in contributors_map:
            contributors_map[cid] = []
        contributors_map[cid].append({"id": s.id, "content": s.content})

    attr_result = await value_attribution.compute_attribution(
        findings=fusion_result.get("findings", []),
        contributors=contributors_map,
        total_budget=float(project.budget_usd),
    )

    for attr in attr_result.get("attributions", []):
        attribution = Attribution(
            product_id=product.id,
            contributor_id=attr["contributor_id"],
            submission_ids=attr.get("submission_ids", []),
            marginal_contribution=attr["marginal_contribution"],
            reason=attr.get("reason", ""),
            payout_usd=Decimal(str(attr["payout_usd"])),
        )
        db.add(attribution)

    project.status = "ready"
    await db.commit()

    # Watchdog: post a help task if confidence is too low
    from app.services.agent_watchdog import check_and_help_low_confidence
    help_task = await check_and_help_low_confidence(
        db=db, project=project,
        fusion_result={
            **fusion_result.get("data_quality", {}),
            "data_quality": fusion_result.get("data_quality", {}),
            "findings": fusion_result.get("findings", []),
        },
        threshold=0.65,
    )
    if help_task:
        await db.commit()

    return {
        "status": "ready",
        "product_title": product.title,
        "findings_count": len(product.findings),
        "agent_help_task": help_task.id if help_task else None,
        "confidence": fusion_result.get("data_quality", {}).get("overall_confidence"),
    }


@router.post("/{project_id}/purchase/order")
async def create_purchase_order(project_id: str, db: AsyncSession = Depends(get_db)):
    """Create a PayPal order for buying the intelligence product."""
    from app.config import settings as cfg

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project or project.status != "ready":
        raise HTTPException(400, "Product not ready for purchase")

    prod_result = await db.execute(
        select(Product).options(selectinload(Product.attributions)).where(Product.project_id == project_id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    total_payout = sum(float(a.payout_usd) for a in product.attributions)
    platform_fee = round(total_payout / 4) if total_payout > 0 else 20
    total_price = total_payout + platform_fee

    if cfg.mock_paypal:
        return {"order_id": f"MOCK-PURCHASE-{product.id[:8]}", "amount": total_price}

    order = await paypal_service.create_order(
        amount_usd=f"{total_price:.2f}",
        description=f"UNMADE Intelligence: {product.title[:80]}",
    )
    return {"order_id": order["id"], "amount": total_price}


@router.post("/{project_id}/purchase")
async def purchase_product(project_id: str, db: AsyncSession = Depends(get_db)):
    """Buyer confirms purchase. Triggers payouts to contributors."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project or project.status != "ready":
        raise HTTPException(400, "Product not ready for purchase")

    # Get attributions
    prod_result = await db.execute(
        select(Product)
        .options(selectinload(Product.attributions))
        .where(Product.project_id == project_id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    # Build payout items
    payout_items = []
    for attr in product.attributions:
        user_result = await db.execute(select(User).where(User.id == attr.contributor_id))
        user = user_result.scalar_one_or_none()
        if user and user.paypal_email:
            payout_items.append({
                "email": user.paypal_email,
                "amount": str(attr.payout_usd),
                "note": f"UNMADE earnings: {product.title}",
            })

    # Execute PayPal payout
    from app.config import settings as cfg
    payout_result = None
    if payout_items:
        if cfg.mock_paypal:
            payout_result = {
                "batch_status": "SUCCESS",
                "batch_id": f"unmade_{product.id[:8]}",
                "payouts": payout_items,
            }
        else:
            try:
                payout_result = await paypal_service.create_payout(
                    batch_id=f"unmade_{product.id[:8]}", items=payout_items
                )
            except Exception as e:
                payout_result = {"error": str(e), "planned_payouts": payout_items}

    project.status = "sold"
    await db.commit()

    return {
        "status": "sold",
        "payout_result": payout_result,
        "attributions": [
            {
                "contributor_id": a.contributor_id,
                "payout_usd": float(a.payout_usd),
                "marginal_contribution": a.marginal_contribution,
            }
            for a in product.attributions
        ],
    }
