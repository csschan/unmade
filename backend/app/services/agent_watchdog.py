"""
Agent Watchdog — detects pipeline problems and auto-generates help tasks.

When the AI agent encounters a situation it cannot resolve alone, it posts
a new task to the Earn page explaining exactly what it needs from humans.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Project, Task


HELP_TASK_TEMPLATES = {
    # Fired when fusion engine returns overall_confidence < threshold
    "low_confidence": {
        "target_contributor": "any_observer",
        "reward_usd": 8.00,
        "max_submissions": 5,
        "build_description": lambda ctx: (
            f"[AI Help Request] The fusion engine analyzed observations for the question "
            f"\"{ctx['question'][:80]}\" but reached only {ctx['confidence']:.0%} confidence "
            f"— below the 65% threshold needed for a reliable intelligence product.\n\n"
            f"Specific gap: {ctx['gap']}\n\n"
            f"Submit a first-hand observation that directly addresses the gap above. "
            f"Include specific names, times, and locations."
        ),
        "build_criteria": lambda ctx: (
            f"Must directly address: {ctx['gap']}. "
            f"Must include at least one specific location and time window. "
            f"Must be first-hand — not a guess or internet search."
        ),
    },

    # Fired when a task has 0 accepted submissions for too long
    "no_submissions": {
        "target_contributor": "any_observer",
        "reward_usd": 12.00,
        "max_submissions": 3,
        "build_description": lambda ctx: (
            f"[AI Help Request] The task \"{ctx['task_description'][:80]}\" has received "
            f"no accepted submissions. The AI agent cannot proceed without at least one "
            f"valid observation for this domain.\n\n"
            f"Required contributor type: {ctx['contributor_type'].replace('_', ' ')}\n"
            f"Location: {ctx['location']}\n\n"
            f"This is blocking the generation of an intelligence product. "
            f"Submit what you know — even a partial observation helps."
        ),
        "build_criteria": lambda ctx: (
            f"Must be from someone with direct experience as a {ctx['contributor_type'].replace('_', ' ')} "
            f"in {ctx['location']}. Must include at least one concrete fact (time, place, or measurement)."
        ),
    },

    # Fired when fusion fails with an exception
    "fusion_error": {
        "target_contributor": "any_observer",
        "reward_usd": 10.00,
        "max_submissions": 4,
        "build_description": lambda ctx: (
            f"[AI Help Request] The fusion engine failed to process submissions for "
            f"\"{ctx['question'][:80]}\".\n\n"
            f"Error: {ctx['error']}\n\n"
            f"The AI suspects the existing observations may be inconsistent or unclear. "
            f"Submit a clear, specific observation to help the engine reconcile conflicting data."
        ),
        "build_criteria": lambda ctx: (
            f"Be as specific as possible. Include exact street names, times, and measurements. "
            f"The AI is struggling to find consistent patterns — your clarity helps."
        ),
    },

    # Fired when all submissions for a task are rejected
    "all_rejected": {
        "target_contributor": "any_observer",
        "reward_usd": 15.00,
        "max_submissions": 3,
        "build_description": lambda ctx: (
            f"[AI Help Request] All {ctx['rejected_count']} submissions for the task "
            f"\"{ctx['task_description'][:80]}\" were rejected.\n\n"
            f"The AI validator rejected them because: {ctx['rejection_pattern']}\n\n"
            f"We specifically need observations with: specific street or location names, "
            f"exact times or durations, and first-hand experience (not guesses)."
        ),
        "build_criteria": lambda ctx: (
            f"Must include: (1) a specific location name, (2) a time or duration, "
            f"(3) a cause or explanation. Generic or vague submissions will be rejected again."
        ),
    },
}


async def create_help_task(
    db: AsyncSession,
    project: Project,
    issue_type: str,
    context: dict,
    location_hint: str = "",
) -> Task:
    """Create an agent-generated help task and persist it."""
    template = HELP_TASK_TEMPLATES[issue_type]

    task = Task(
        project_id=project.id,
        description=template["build_description"](context),
        target_contributor=template["target_contributor"],
        location_hint=location_hint or context.get("location", ""),
        validation_criteria=template["build_criteria"](context),
        reward_usd=Decimal(str(template["reward_usd"])),
        max_submissions=template["max_submissions"],
        status="open",
    )
    db.add(task)
    await db.flush()
    return task


async def check_and_help_low_confidence(
    db: AsyncSession,
    project: Project,
    fusion_result: dict,
    threshold: float = 0.65,
) -> Task | None:
    """After fusion, if confidence is too low, post a help task."""
    confidence = fusion_result.get("data_quality", {}).get("overall_confidence", 1.0)
    if confidence >= threshold:
        return None

    # Identify the weakest finding to describe the gap
    findings = fusion_result.get("findings", [])
    weakest = min(findings, key=lambda f: f["confidence"]) if findings else {}
    gap = weakest.get("claim", "More corroborating observations needed")[:120]

    task = await create_help_task(
        db=db,
        project=project,
        issue_type="low_confidence",
        context={
            "question": project.question,
            "confidence": confidence,
            "gap": gap,
        },
        location_hint=project.demand_analysis.get("suggested_location", "") if project.demand_analysis else "",
    )
    return task


async def check_and_help_no_submissions(
    db: AsyncSession,
    project: Project,
) -> list[Task]:
    """Check if any task has 0 accepted submissions and post help tasks."""
    result = await db.execute(select(Task).where(Task.project_id == project.id))
    tasks = result.scalars().all()

    help_tasks = []
    for t in tasks:
        if t.accepted_count == 0 and t.status == "open" and not t.description.startswith("[AI Help Request]"):
            help_task = await create_help_task(
                db=db,
                project=project,
                issue_type="no_submissions",
                context={
                    "task_description": t.description,
                    "contributor_type": t.target_contributor or "observer",
                    "location": t.location_hint or "the relevant area",
                },
                location_hint=t.location_hint or "",
            )
            help_tasks.append(help_task)
    return help_tasks
