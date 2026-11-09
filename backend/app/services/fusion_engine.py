import json

import anthropic

from app.config import settings

SYSTEM_PROMPT = """You are the Information Fusion Engine for UNMADE. This is the core of the platform.

Your job: take multiple independent observations from different contributors and FUSE them to discover
relationships, correlations, and insights that NO SINGLE contributor could see alone.

This is NOT summarization. This is NOT aggregation. You must:
1. Cross-validate: check if independent observations corroborate each other
2. Discover correlations: find hidden connections between observations from different domains
3. Generate hypotheses: form testable claims that emerge ONLY from combining multiple sources
4. Assess confidence: rate each finding based on evidence strength
5. Mark novelty: explicitly flag which findings require multiple sources (novel) vs derivable from one (not novel)

Respond with valid JSON only, no markdown."""

FUSION_PROMPT = """Fuse these independent observations into an intelligence product.

Business question: {question}

Submissions (each from a different, independent contributor):
{submissions_text}

Generate this JSON structure:
{{
  "title": "Short, descriptive product title",
  "summary": "2-3 sentence executive summary of key findings",
  "findings": [
    {{
      "claim": "A specific, actionable finding",
      "confidence": 0.0-1.0,
      "supporting_submissions": ["sub_id_1", "sub_id_2"],
      "cross_validated": true/false,
      "novel": true/false,
      "reasoning": "How this finding was derived from the combined observations"
    }}
  ],
  "correlations_discovered": [
    {{
      "between": ["submission_id_1", "submission_id_2"],
      "relationship": "Description of the hidden relationship discovered",
      "strength": "strong/moderate/weak"
    }}
  ],
  "limitations": ["What this analysis cannot confirm without more data"],
  "data_quality": {{
    "total_sources": number,
    "cross_validated_pairs": number,
    "novel_findings_count": number,
    "overall_confidence": 0.0-1.0
  }}
}}

Rules:
- At least one finding MUST be novel (requires multiple sources)
- Cross-validated means two independent sources support the same claim
- Confidence should reflect actual evidence strength, not be inflated
- If submissions don't reveal meaningful correlations, say so honestly
- Mark findings as novel=false if they could be derived from a single submission"""


async def fuse(question: str, submissions: list[dict]) -> dict:
    if settings.use_mock:
        from app.services.mock_data import FUSION_RESULT
        # Replace placeholder submission IDs with real ones
        result = FUSION_RESULT.copy()
        real_ids = [s["id"] for s in submissions]
        id_map = {}
        for i, placeholder in enumerate(["sub_courier", "sub_driver", "sub_resident"]):
            if i < len(real_ids):
                id_map[placeholder] = real_ids[i]
        # Update submission references in findings
        import json as _json
        result_str = _json.dumps(result)
        for old_id, new_id in id_map.items():
            result_str = result_str.replace(old_id, new_id)
        return _json.loads(result_str)

    submissions_text = "\n\n".join(
        f"[{s['id']}] Contributor type: {s.get('contributor_type', 'unknown')}\n"
        f"Task: {s.get('task_description', 'N/A')}\n"
        f"Observation: {s['content']}"
        for s in submissions
    )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": FUSION_PROMPT.format(
                    question=question, submissions_text=submissions_text
                ),
            }
        ],
    )

    text = message.content[0].text
    from app.services._utils import parse_claude_json
    return parse_claude_json(text)
