import json

import anthropic

from app.config import settings

SYSTEM_PROMPT = """You are the Value Attribution Engine for UNMADE.

Your job: determine how much each contributor's information contributed to the final intelligence product.

Method: Leave-one-out marginal contribution analysis.
For each contributor, assess: if we removed ALL their submissions, how much would the product quality drop?

This is not a subjective rating. Consider:
1. Uniqueness: did this contributor provide information no one else did?
2. Criticality: does removing their data eliminate any novel findings?
3. Corroboration: did their data validate others' observations (increasing confidence)?
4. Relevance: how directly did their submission address the buyer's question?

Respond with valid JSON only, no markdown."""

ATTRIBUTION_PROMPT = """Compute value attribution for this intelligence product.

Product findings:
{findings_text}

Contributors and their submissions:
{contributors_text}

Total revenue to distribute: ${distributable} (after 20% platform fee from ${total} total)

Generate this JSON:
{{
  "attributions": [
    {{
      "contributor_id": "user_id",
      "submission_ids": ["sub_id_1"],
      "marginal_contribution": 0.0-1.0,
      "reason": "Why this contributor's data was worth this share",
      "payout_usd": number
    }}
  ],
  "method_notes": "Brief explanation of how attribution was determined"
}}

Rules:
- marginal_contribution values must sum to 1.0
- payout_usd values must sum to exactly {distributable}
- A contributor whose removal would eliminate a novel finding gets higher weight
- A contributor providing redundant information gets lower weight
- Be specific in reasons — reference actual findings and submissions"""


async def compute_attribution(
    findings: list[dict],
    contributors: dict[str, list[dict]],
    total_budget: float,
) -> dict:
    if settings.use_mock:
        from app.services.mock_data import ATTRIBUTION_RESULT
        # Scale payouts to actual budget
        result = json.loads(json.dumps(ATTRIBUTION_RESULT))
        platform_fee = total_budget * 0.20
        distributable = total_budget - platform_fee
        for attr in result["attributions"]:
            attr["payout_usd"] = round(attr["marginal_contribution"] * distributable, 2)
            # Map real submission IDs from contributors
            cid = attr["contributor_id"]
            if cid in contributors:
                attr["submission_ids"] = [s["id"] for s in contributors[cid]]
        result["platform_fee"] = platform_fee
        result["total_budget"] = total_budget
        return result

    platform_fee = total_budget * 0.20
    distributable = total_budget - platform_fee

    findings_text = json.dumps(findings, indent=2)
    contributors_text = "\n\n".join(
        f"Contributor {cid}:\n"
        + "\n".join(f"  [{s['id']}] {s['content']}" for s in subs)
        for cid, subs in contributors.items()
    )

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": ATTRIBUTION_PROMPT.format(
                    findings_text=findings_text,
                    contributors_text=contributors_text,
                    total=total_budget,
                    distributable=distributable,
                ),
            }
        ],
    )

    text = message.content[0].text
    from app.services._utils import normalize_attributions, parse_claude_json
    result = parse_claude_json(text)
    # Normalize so payouts always sum exactly to distributable
    result["attributions"] = normalize_attributions(result["attributions"], distributable)
    result["platform_fee"] = platform_fee
    result["total_budget"] = total_budget
    return result
