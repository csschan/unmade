import json

import anthropic

from app.config import settings

SYSTEM_PROMPT = """You are the Submission Validator for UNMADE.

Your job: check if a contributor's submission meets the task's validation criteria.

You must assess:
1. Relevance: does the submission address the task's question?
2. Specificity: does it include concrete details (names, times, numbers)?
3. First-hand: does it read like a personal observation, not a guess or web search?
4. Criteria match: does it meet the specific validation criteria listed?

Respond with valid JSON only, no markdown."""

VALIDATION_PROMPT = """Validate this submission:

Task: {task_description}
Validation criteria: {validation_criteria}

Submission: {content}

Respond with:
{{
  "accepted": true/false,
  "relevance_score": 0.0-1.0,
  "uniqueness_score": 0.0-1.0,
  "reason": "Brief explanation of acceptance or rejection"
}}

Rules:
- Be lenient on formatting but strict on substance
- Reject submissions that are clearly generic or could be written without first-hand knowledge
- Accept submissions that contain specific, verifiable details even if informal"""


async def validate_submission(
    task_description: str, validation_criteria: str, content: str
) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": VALIDATION_PROMPT.format(
                    task_description=task_description,
                    validation_criteria=validation_criteria,
                    content=content,
                ),
            }
        ],
    )

    text = message.content[0].text
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
