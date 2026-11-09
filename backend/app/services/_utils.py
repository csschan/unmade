"""Shared utilities for AI service responses."""

import json
import re


def parse_claude_json(text: str) -> dict | list:
    """
    Robustly parse JSON from a Claude response.
    Handles: plain JSON, ```json ... ```, ``` ... ```, leading/trailing text.
    """
    text = text.strip()

    # Strip markdown fences: ```json, ```JSON, ```
    if text.startswith("```"):
        # Remove opening fence line
        text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
        # Remove closing fence
        text = re.sub(r'\n?```\s*$', '', text)
        text = text.strip()

    # If there's still non-JSON text before the first { or [, strip it
    match = re.search(r'[{\[]', text)
    if match and match.start() > 0:
        text = text[match.start():]

    return json.loads(text)


def normalize_attributions(attributions: list[dict], distributable: float) -> list[dict]:
    """
    Ensure payout_usd values sum exactly to distributable.
    Normalizes marginal_contribution to sum to 1.0, then recomputes payouts.
    """
    total_contribution = sum(a.get("marginal_contribution", 0) for a in attributions)
    if total_contribution <= 0:
        # Equal split fallback
        share = 1.0 / len(attributions)
        for a in attributions:
            a["marginal_contribution"] = share

    # Normalize contributions to sum to 1.0
    total = sum(a["marginal_contribution"] for a in attributions)
    for a in attributions:
        a["marginal_contribution"] = round(a["marginal_contribution"] / total, 4)

    # Recompute payouts from normalized contributions
    running = 0.0
    for i, a in enumerate(attributions[:-1]):
        payout = round(a["marginal_contribution"] * distributable, 2)
        a["payout_usd"] = payout
        running += payout
    # Last item gets the remainder to avoid floating point drift
    attributions[-1]["payout_usd"] = round(distributable - running, 2)

    return attributions
