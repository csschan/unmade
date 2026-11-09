from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Project, Submission, Task
from app.services import submission_validator

class PreValidateRequest(BaseModel):
    content: str

router = APIRouter()


class SubmitRequest(BaseModel):
    content: str
    evidence_url: str | None = None


def _task_dict(t: Task, project: Project | None = None) -> dict:
    d: dict = {
        "id": t.id,
        "description": t.description,
        "target_contributor": t.target_contributor,
        "location_hint": t.location_hint,
        "reward_usd": float(t.reward_usd),
        "max_submissions": t.max_submissions,
        "accepted_count": t.accepted_count,
        "status": t.status,
    }
    if project:
        d["project"] = {
            "id": project.id,
            "question": project.question,
            "budget_usd": float(project.budget_usd),
            "requester": project.demand_analysis.get("requester_name", "FreshDash Logistics") if project.demand_analysis else "FreshDash Logistics",
            "why_ground_truth": project.demand_analysis.get("why_chatgpt_cannot_answer", "") if project.demand_analysis else "",
            "total_tasks": 0,  # filled below
        }
    return d


@router.get("")
async def list_tasks(
    status: str = Query("open"),
    location: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List open tasks for contributors, with project context."""
    query = (
        select(Task)
        .options(selectinload(Task.project))
        .join(Project, Task.project_id == Project.id)
        .where(Task.status == status)
        .where(Project.status == "collecting")
    )
    if location:
        query = query.where(Task.location_hint.ilike(f"%{location}%"))

    result = await db.execute(query)
    tasks = result.scalars().all()

    out = []
    for t in tasks:
        d = _task_dict(t, t.project)
        if d.get("project") and t.project:
            sibling_result = await db.execute(
                select(Task).where(Task.project_id == t.project_id)
            )
            siblings = sibling_result.scalars().all()
            d["project"]["total_tasks"] = len(siblings)
            d["project"]["sibling_tasks"] = [
                {"id": s.id, "description": s.description[:60] + "...", "target_contributor": s.target_contributor, "reward_usd": float(s.reward_usd), "accepted_count": s.accepted_count}
                for s in siblings if s.id != t.id and s.status == "open"
            ]
        out.append(d)
    return out


@router.get("/{task_id}")
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task).options(selectinload(Task.project)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    d = _task_dict(task, task.project)
    if d.get("project") and task.project:
        sibling_result = await db.execute(
            select(Task).where(Task.project_id == task.project_id)
        )
        siblings = sibling_result.scalars().all()
        d["project"]["total_tasks"] = len(siblings)
        d["project"]["sibling_tasks"] = [
            {"id": s.id, "description": s.description[:60] + "...", "target_contributor": s.target_contributor, "reward_usd": float(s.reward_usd), "accepted_count": s.accepted_count}
            for s in siblings if s.id != task.id and s.status == "open"
        ]
        d["validation_criteria"] = task.validation_criteria
    else:
        d["validation_criteria"] = task.validation_criteria
    return d


@router.post("/{task_id}/pre-validate")
async def pre_validate_submission(
    task_id: str,
    req: PreValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Real-time semantic analysis while user is typing. Fast, non-binding."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    analysis = await submission_validator.pre_validate(
        task_description=task.description,
        validation_criteria=task.validation_criteria,
        content=req.content,
    )
    return analysis


@router.post("/{task_id}/submit")
async def submit_observation(
    task_id: str,
    req: SubmitRequest,
    user_id: str = Query(..., description="Contributor user ID"),
    db: AsyncSession = Depends(get_db),
):
    """Submit an observation for a task. AI validates immediately."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    if task.status != "open":
        raise HTTPException(400, "Task is no longer accepting submissions")

    # Prevent same contributor submitting twice to the same task
    existing = (await db.execute(
        select(Submission).where(
            Submission.task_id == task_id,
            Submission.contributor_id == user_id,
            Submission.status == "accepted",
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "You have already submitted an accepted observation for this task.")

    # AI validation
    validation = await submission_validator.validate_submission(
        task_description=task.description,
        validation_criteria=task.validation_criteria,
        content=req.content,
    )

    accepted = validation.get("accepted", False)

    submission = Submission(
        task_id=task_id,
        contributor_id=user_id,
        content=req.content,
        evidence_url=req.evidence_url,
        ai_relevance_score=validation.get("relevance_score", 0),
        ai_uniqueness_score=validation.get("uniqueness_score", 0),
        status="accepted" if accepted else "rejected",
        rejection_reason=None if accepted else validation.get("reason"),
    )
    db.add(submission)

    if accepted:
        task.accepted_count += 1
        if task.accepted_count >= task.max_submissions:
            task.status = "filled"

    await db.commit()
    await db.refresh(submission)

    return {
        "id": submission.id,
        "status": submission.status,
        "relevance_score": submission.ai_relevance_score,
        "uniqueness_score": submission.ai_uniqueness_score,
        "reason": validation.get("reason", ""),
    }


@router.get("/me/submissions")
async def my_submissions(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Submission).where(Submission.contributor_id == user_id)
    )
    submissions = result.scalars().all()

    return [
        {
            "id": s.id,
            "task_id": s.task_id,
            "content": s.content,
            "status": s.status,
            "relevance_score": s.ai_relevance_score,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in submissions
    ]
