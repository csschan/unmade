import json
import re

import anthropic

from app.config import settings

# ── Final validation (called on submit) ─────────────────────────────────────

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

# ── Pre-validation (called while user types) ─────────────────────────────────

PRE_VALIDATE_SYSTEM = """You are a real-time submission quality analyzer for UNMADE.

Analyze the submission-in-progress and return structured feedback on each quality dimension.
Be helpful and constructive — the user is still writing.

Respond with valid JSON only, no markdown."""

PRE_VALIDATE_PROMPT = """Analyze this submission draft:

Task: {task_description}
Criteria: {validation_criteria}
Draft: {content}

Return JSON:
{{
  "overall_score": 0-100,
  "ready_to_submit": true/false,
  "dimensions": {{
    "relevance":    {{"pass": true/false, "score": 0-100, "note": "one line feedback"}},
    "specificity":  {{"pass": true/false, "score": 0-100, "note": "one line feedback"}},
    "first_hand":   {{"pass": true/false, "score": 0-100, "note": "one line feedback"}},
    "completeness": {{"pass": true/false, "score": 0-100, "note": "one line feedback"}}
  }},
  "missing": ["list of specific things still needed, e.g. 'street name', 'time window'"],
  "tip": "one actionable suggestion to improve the submission"
}}"""


def _mock_pre_validate(content: str, task_description: str) -> dict:
    """Simulate semantic analysis without calling the real API."""
    text = content.strip()
    lower = text.lower()
    task_lower = task_description.lower()
    words = text.split()
    word_count = len(words)

    # ── Dimension: relevance ──
    # Use task domain detection to pick the right signals (not London-only)
    domain = _detect_task_domain(task_lower)
    domain_signals = DOMAIN_SIGNALS.get(domain, [])

    # Also include general signals that apply across domains
    general_signals = ["traffic", "congestion", "road", "street", "junction", "drive", "gridlock",
                       "construction", "roadwork", "resident", "market", "building", "local"]

    all_signals = domain_signals + general_signals
    matched = sum(1 for s in all_signals if s in lower)
    relevance_score = min(100, matched * 14)

    # Fallback: word overlap between task description and submission
    if relevance_score < 20:
        task_words = set(re.findall(r'\b\w{4,}\b', task_lower))
        sub_words  = set(re.findall(r'\b\w{4,}\b', lower))
        overlap = len(task_words & sub_words)
        relevance_score = max(relevance_score, min(100, overlap * 12))
    relevance_pass = relevance_score >= 35

    # ── Dimension: specificity ──
    has_proper_nouns = bool(re.search(r'\b[A-Z][a-z]{2,}\b', text))
    has_numbers = bool(re.search(r'\d+', text))
    has_time = bool(re.search(r'(\d{1,2}\s*[-–]\s*\d{1,2}\s*(am|pm)|'
                               r'\d{1,2}(am|pm|:\d\d)|'
                               r'(morning|evening|afternoon|night|pm|am))', lower))
    has_location = bool(re.search(r'\b(street|road|lane|avenue|st\b|rd\b|junction|corner|high\s+st)\b', lower))
    specificity_points = sum([has_proper_nouns, has_numbers, has_time, has_location]) * 25
    specificity_score = min(100, specificity_points)
    specificity_pass = specificity_score >= 50

    missing_elements = []
    if not has_proper_nouns:
        missing_elements.append("specific name (street, restaurant, landmark)")
    if not has_numbers:
        missing_elements.append("numbers (minutes, distance, frequency)")
    if not has_time:
        missing_elements.append("time window (e.g. '6–8 PM', 'Friday evenings')")
    if not has_location and "location" in task_lower:
        missing_elements.append("specific location")

    # ── Dimension: first-hand ──
    second_hand_phrases = ["according to", "it is reported", "research shows", "studies show",
                           "experts say", "i heard", "someone told me", "i read that"]
    first_person = bool(re.search(r'\b(i |my |i\'ve|i\'m|we |our )\b', lower))
    is_second_hand = any(p in lower for p in second_hand_phrases)
    first_hand_score = 20 if is_second_hand else (90 if first_person else 60)
    first_hand_pass = not is_second_hand and first_hand_score >= 60

    # ── Dimension: completeness ──
    completeness_score = min(100, int((word_count / 40) * 100))
    completeness_pass = word_count >= 20

    # ── Overall ──
    overall = int((relevance_score * 0.3 + specificity_score * 0.35 +
                   first_hand_score * 0.2 + completeness_score * 0.15))
    ready = overall >= 65 and relevance_pass and specificity_pass and first_hand_pass and completeness_pass

    # ── Tip ──
    if is_second_hand:
        tip = "Rewrite in first person — describe what YOU personally saw or experienced."
    elif not has_proper_nouns and not has_numbers:
        tip = "Add a specific street name or location, and include at least one number (time, duration, or count)."
    elif not has_time:
        tip = "Mention the specific time window when you observed this (e.g. 'every Friday 6–8 PM')."
    elif word_count < 20:
        tip = "Add more detail — describe what you saw, when, and why you think it's happening."
    elif not relevance_pass:
        tip = "Make sure your observation directly addresses the task question."
    else:
        tip = "Looking good — consider adding one more specific detail to strengthen your submission."

    return {
        "overall_score": overall,
        "ready_to_submit": ready,
        "dimensions": {
            "relevance":    {"pass": relevance_pass,    "score": relevance_score,    "note": "Matches task topic" if relevance_pass else "Doesn't clearly address the task"},
            "specificity":  {"pass": specificity_pass,  "score": specificity_score,  "note": "Has names, numbers, times" if specificity_pass else "Too vague — add specific details"},
            "first_hand":   {"pass": first_hand_pass,   "score": first_hand_score,   "note": "Reads as personal observation" if first_hand_pass else "Sounds second-hand"},
            "completeness": {"pass": completeness_pass, "score": completeness_score, "note": f"{word_count} words — sufficient" if completeness_pass else f"Only {word_count} words — add more detail"},
        },
        "missing": missing_elements,
        "tip": tip,
    }


async def pre_validate(task_description: str, validation_criteria: str, content: str) -> dict:
    """Quick semantic analysis while user is typing. Called before final submit."""
    if not content.strip() or len(content.split()) < 3:
        return {
            "overall_score": 0,
            "ready_to_submit": False,
            "dimensions": {
                "relevance":    {"pass": False, "score": 0, "note": "Start writing to see analysis"},
                "specificity":  {"pass": False, "score": 0, "note": "Start writing to see analysis"},
                "first_hand":   {"pass": False, "score": 0, "note": "Start writing to see analysis"},
                "completeness": {"pass": False, "score": 0, "note": "Start writing to see analysis"},
            },
            "missing": [],
            "tip": "Start writing your observation to see real-time AI feedback.",
        }

    if settings.use_mock:
        return _mock_pre_validate(content, task_description)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # fast model for real-time feedback
        max_tokens=512,
        system=PRE_VALIDATE_SYSTEM,
        messages=[{"role": "user", "content": PRE_VALIDATE_PROMPT.format(
            task_description=task_description,
            validation_criteria=validation_criteria,
            content=content,
        )}],
    )
    text = message.content[0].text
    from app.services._utils import parse_claude_json
    return parse_claude_json(text)


def _detect_task_domain(task_lower: str) -> str:
    """Identify the primary domain of a task from its description."""
    if any(w in task_lower for w in ["mrt", "subway", "metro", "station", "train line", "overcrowd", "carriage", "platform"]):
        return "mrt"
    if any(w in task_lower for w in ["cycling", "cyclist", "bike", "bicycle", "cycle lane"]):
        return "cycling"
    if any(w in task_lower for w in ["rideshare", "uber", "lyft", "ride-hail", "ride hail", "ridesharing"]):
        return "rideshare"
    if any(w in task_lower for w in ["restaurant", "food delivery", "courier", "delivery time", "wait time", "pickup"]):
        return "delivery"
    if any(w in task_lower for w in ["traffic", "congestion", "gridlock", "commute", "road", "street"]):
        return "traffic"
    return "general"


DOMAIN_SIGNALS: dict[str, list[str]] = {
    "mrt":      ["mrt", "station", "train", "platform", "interchange", "carriage", "packed", "bishan",
                 "orchard", "raffles", "dhoby", "serangoon", "ang mo kio", "north-south", "circle line",
                 "north east", "east west", "downtown line", "peak hour", "overcrowd"],
    "cycling":  ["bike", "bicycle", "cycling", "cyclist", "cycle", "lane", "helmet", "pedal",
                 "handlebars", "infrastructure", "path", "trail", "velodrome"],
    "rideshare":["uber", "lyft", "rideshare", "ride-share", "ride share", "driver", "passenger",
                 "pickup", "dropoff", "surge", "rating", "app", "carpool", "ola", "grab"],
    "delivery": ["restaurant", "kitchen", "wait", "pickup", "courier", "deliver",
                 "food", "order ready", "preparation", "queue", "table", "dine"],
    "traffic":  ["traffic", "congestion", "gridlock", "road", "junction", "street", "drive",
                 "commute", "bottleneck", "lane", "rush hour"],
    "general":  [],
}


def _check_topic_relevance(task_lower: str, content_lower: str) -> tuple[bool, str]:
    """
    Returns (is_relevant, rejection_reason).
    Uses task domain detection + keyword overlap to filter off-topic submissions.
    """
    domain = _detect_task_domain(task_lower)
    if domain == "general":
        return True, ""

    signals = DOMAIN_SIGNALS[domain]
    submission_matches = sum(1 for s in signals if s in content_lower)

    if submission_matches >= 1:
        return True, ""

    # Fallback: word overlap between task and submission (4+ char words)
    task_words = set(re.findall(r'\b\w{4,}\b', task_lower))
    sub_words  = set(re.findall(r'\b\w{4,}\b', content_lower))
    overlap    = len(task_words & sub_words)
    if overlap >= 3:
        return True, ""

    domain_labels = {
        "mrt":      "MRT/train station crowding",
        "cycling":  "cycling infrastructure",
        "rideshare":"rideshare / ride-hail experience",
        "delivery": "restaurant wait times or food delivery",
        "traffic":  "road traffic or congestion",
    }
    label = domain_labels.get(domain, "the task topic")
    return False, (
        f"Submission doesn't address the task. This mission requires first-hand observations about "
        f"{label}. Your submission appears to be about a different topic."
    )


async def validate_submission(
    task_description: str, validation_criteria: str, content: str
) -> dict:
    if settings.use_mock:
        from app.services.mock_data import SUBMISSION_VALIDATIONS

        lower = content.lower().strip()
        task_lower = task_description.lower()
        word_count = len(lower.split())

        # 1. Length check
        if word_count < 15:
            return {"accepted": False, "relevance_score": 0.10, "uniqueness_score": 0.05,
                    "reason": "Submission is too short. Provide at least 2-3 sentences with specific details."}

        # 2. Specificity check
        has_specific = any(c.isupper() for c in content)
        has_numbers = any(c.isdigit() for c in content)
        if not has_numbers:
            return {"accepted": False, "relevance_score": 0.20, "uniqueness_score": 0.05,
                    "reason": "Submission lacks concrete measurements — no times, wait durations, distances, or counts. Add specific numbers (e.g. '18-25 minutes', '7-9 PM', '3 blocks')."}
        if not has_specific:
            return {"accepted": False, "relevance_score": 0.25, "uniqueness_score": 0.10,
                    "reason": "Submission lacks specific details — no street names, restaurant names, or proper nouns. Add specific names and locations."}

        # 3. Second-hand check
        third_person_signals = ["according to", "it is reported", "studies show", "research indicates", "experts say"]
        if any(sig in lower for sig in third_person_signals):
            return {"accepted": False, "relevance_score": 0.30, "uniqueness_score": 0.05,
                    "reason": "Submission reads like second-hand information. We need first-hand personal observations only."}

        # 4. Topic relevance check — reject submissions that don't match the task domain
        is_relevant, rejection_reason = _check_topic_relevance(task_lower, lower)
        if not is_relevant:
            return {"accepted": False, "relevance_score": 0.12, "uniqueness_score": 0.05,
                    "reason": rejection_reason}

        # 5. Domain-specific scoring
        if any(w in lower for w in DOMAIN_SIGNALS["delivery"]):
            return SUBMISSION_VALIDATIONS["courier_good"]
        elif any(w in lower for w in DOMAIN_SIGNALS["traffic"]):
            return SUBMISSION_VALIDATIONS["driver_good"]
        elif any(w in lower for w in ["construction", "roadwork", "divert", "resident", "neighbourhood", "building", "market"]):
            return SUBMISSION_VALIDATIONS["resident_good"]

        return {"accepted": True, "relevance_score": 0.72, "uniqueness_score": 0.65,
                "reason": "Submission contains specific details and reads as a first-hand observation."}

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": VALIDATION_PROMPT.format(
            task_description=task_description,
            validation_criteria=validation_criteria,
            content=content,
        )}],
    )
    text = message.content[0].text
    from app.services._utils import parse_claude_json
    return parse_claude_json(text)
