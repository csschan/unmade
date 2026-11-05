import json

import anthropic

from app.config import settings

SYSTEM_PROMPT = """You are the Task Decomposer for UNMADE. Given a validated business question and its
information domains, break it down into specific collection tasks that ordinary people can complete.

Each task must be:
1. Answerable from one person's direct, first-hand experience
2. Completable in under 2 minutes (simple observation or short answer)
3. Verifiable against stated criteria
4. Specific enough that a contributor knows exactly what to report

Respond with valid JSON only, no markdown."""

USER_PROMPT_TEMPLATE = """Decompose this business question into collection tasks:

Question: {question}
Information domains: {domains}
Budget: ${budget}
Estimated contributors needed: {contributors_needed}

Respond with this JSON structure:
{{
  "tasks": [
    {{
      "description": "Clear instruction for what to observe/report",
      "target_contributor": "type of person who would know this (e.g. delivery_courier, taxi_driver, resident)",
      "location_hint": "geographic area if applicable",
      "validation_criteria": "How to check if the submission is useful and truthful",
      "reward_per_submission": number (in USD, typically 1-5),
      "max_submissions": number (typically 3-10)
    }}
  ]
}}

Rules:
- Create 3-6 tasks that together cover the full question
- Each task targets a different type of contributor or information domain
- Rewards should sum to roughly 60-80% of the total budget (rest is platform fee + fusion cost)
- validation_criteria must be specific and checkable"""


async def decompose(question: str, domains: list[str], budget: float, contributors_needed: int) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(
                    question=question,
                    domains=json.dumps(domains),
                    budget=budget,
                    contributors_needed=contributors_needed,
                ),
            }
        ],
    )

    text = message.content[0].text
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
