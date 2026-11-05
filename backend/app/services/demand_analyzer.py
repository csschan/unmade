import json

import anthropic

from app.config import settings

SYSTEM_PROMPT = """You are the Demand Analyzer for UNMADE, an AI-native market for collective intelligence.

Your job: evaluate whether a business question requires GROUND-TRUTH information from real people,
or if it can be answered with publicly available data (in which case, reject it).

UNMADE only creates value when the answer requires observations from people physically present
in specific locations or contexts — information that no AI can generate from training data.

Respond with valid JSON only, no markdown."""

USER_PROMPT_TEMPLATE = """Evaluate this business question:

Question: {question}
Budget: ${budget}

Respond with this JSON structure:
{{
  "is_answerable": true/false,
  "requires_ground_truth": true/false,
  "rejection_reason": "only if rejected, explain why",
  "estimated_contributors_needed": number,
  "information_domains": ["domain1", "domain2"],
  "why_chatgpt_cannot_answer": "explain what real-world observation is needed",
  "suggested_location": "geographic area if applicable"
}}

Rules:
- requires_ground_truth must be true for the project to proceed
- If the question can be fully answered by searching the internet, set requires_ground_truth to false
- information_domains should be specific types of knowledge held by specific types of people
- estimated_contributors_needed should be realistic (3-20 for a hackathon demo)"""


async def analyze_demand(question: str, budget: float) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(question=question, budget=budget),
            }
        ],
    )

    text = message.content[0].text
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
