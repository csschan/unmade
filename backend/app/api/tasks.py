from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Submission, Task
from app.services import submission_validator

router = APIRouter()


class SubmitRequest(BaseModel):
    content: str
    evidence_url: str | None = None


@router.get("")
async def list_tasks(
    status: str = Query("open"),
    location: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List open tasks for contributors."""
    query = select(Task).where(Task.status == status)
    if location:
        query = query.where(Task.location_hint.ilike(f"%{location}%"))

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
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
        for t in tasks
    ]


@router.get("/{task_id}")
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    return {
        "id": task.id,
        "description": task.description,
        "target_contributor": task.target_contributor,
        "location_hint": task.location_hint,
        "validation_criteria": task.validation_criteria,
        "reward_usd": float(task.reward_usd),
        "max_submissions": task.max_submissions,
        "accepted_count": task.accepted_count,
        "status": task.status,
    }


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
