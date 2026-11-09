"""
Pre-computed AI responses for the London Delivery demo scenario.
These mirror the exact output format of the real AI engines.
Only used when USE_MOCK=true — the AI engine code itself is unchanged.
"""

DEMAND_ANALYSIS = {
    "is_answerable": True,
    "requires_ground_truth": True,
    "rejection_reason": None,
    "estimated_contributors_needed": 3,
    "information_domains": [
        "delivery_logistics",
        "traffic_patterns",
        "local_infrastructure",
    ],
    "why_chatgpt_cannot_answer": (
        "This question requires real-time, first-hand observations from people "
        "physically present in specific London neighbourhoods — delivery couriers "
        "who experience restaurant wait times, drivers who observe traffic patterns, "
        "and residents who know about ongoing construction. No public dataset or "
        "AI training data captures this granular, current ground truth."
    ),
    "suggested_location": "Central London",
}

TASK_DECOMPOSITION = {
    "tasks": [
        {
            "description": (
                "Report average wait time when picking up orders from restaurants "
                "in your area during evening peak hours (5-9 PM). Include the restaurant "
                "name, specific time, and how long you waited."
            ),
            "target_contributor": "delivery_courier",
            "location_hint": "Central London",
            "validation_criteria": (
                "Must include: specific restaurant name, day of week, time window, "
                "and estimated wait time in minutes. Generic statements without "
                "specific details will be rejected."
            ),
            "reward_per_submission": 3.00,
            "max_submissions": 5,
        },
        {
            "description": (
                "Report traffic conditions on specific streets during weekday evenings "
                "(5-9 PM). Include which streets are congested, the time you observed it, "
                "and any visible cause of the congestion."
            ),
            "target_contributor": "taxi_driver",
            "location_hint": "Central London",
            "validation_criteria": (
                "Must include: specific street name, day and time of observation, "
                "severity of congestion, and any observable cause (market, event, "
                "construction). Vague reports will be rejected."
            ),
            "reward_per_submission": 3.00,
            "max_submissions": 5,
        },
        {
            "description": (
                "Report any ongoing road works, construction, or street events that "
                "affect traffic or delivery access in your neighbourhood. Include location, "
                "how long it has been going on, and which routes are affected."
            ),
            "target_contributor": "local_resident",
            "location_hint": "Central London",
            "validation_criteria": (
                "Must include: specific location, nature of disruption, approximate "
                "start date or duration, and which alternative routes people use. "
                "Second-hand information from news articles will be rejected."
            ),
            "reward_per_submission": 2.00,
            "max_submissions": 5,
        },
    ]
}

SUBMISSION_VALIDATIONS = {
    "courier_good": {
        "accepted": True,
        "relevance_score": 0.92,
        "uniqueness_score": 0.85,
        "reason": (
            "Submission includes specific restaurant name, exact day and time, "
            "and precise wait time in minutes. This is clearly a first-hand observation "
            "from someone who regularly picks up orders in the area."
        ),
    },
    "driver_good": {
        "accepted": True,
        "relevance_score": 0.88,
        "uniqueness_score": 0.90,
        "reason": (
            "Submission provides specific street name, recurring pattern with day "
            "and time, and identifies a visible cause. Consistent with direct "
            "observation from someone who drives this route regularly."
        ),
    },
    "resident_good": {
        "accepted": True,
        "relevance_score": 0.85,
        "uniqueness_score": 0.95,
        "reason": (
            "Submission provides unique infrastructure information with specific "
            "location, duration, and traffic diversion details. This kind of "
            "ongoing local knowledge is not available in any public dataset."
        ),
    },
    "generic_bad": {
        "accepted": False,
        "relevance_score": 0.20,
        "uniqueness_score": 0.10,
        "reason": (
            "Submission is too generic — no specific names, times, or locations. "
            "This could have been written without first-hand knowledge of the area."
        ),
    },
}

FUSION_RESULT = {
    "title": "London Delivery Intelligence — King Street Area Bottleneck Analysis",
    "summary": (
        "Friday evening delivery delays in the King Street corridor are 2-3x worse "
        "than other weekdays, driven by a compound effect of two independent factors: "
        "a weekly street market causing traffic congestion AND a months-long construction "
        "diversion from a parallel street. Neither factor alone explains the severity — "
        "their interaction creates a multiplier effect that significantly impacts "
        "delivery logistics in the area."
    ),
    "findings": [
        {
            "claim": (
                "Friday evening delivery delays in King Street area are caused by "
                "compound effect of weekly street market traffic AND construction "
                "diversion from Queen Street. The market alone would cause moderate "
                "delays, but combined with diverted traffic from construction, "
                "restaurant wait times increase to 30-40 minutes vs 15-20 on other days."
            ),
            "confidence": 0.82,
            "supporting_submissions": ["sub_courier", "sub_driver", "sub_resident"],
            "cross_validated": True,
            "novel": True,
            "reasoning": (
                "Courier reports 35-min wait at Restaurant Bella on King Street on Fridays. "
                "Driver independently confirms King Street is gridlocked Fridays 6-8 PM due to "
                "street market. Resident adds that Queen Street construction since October diverts "
                "all traffic to King Street. The COMBINATION of market + diversion explains the "
                "severity — this correlation is invisible to any single observer."
            ),
        },
        {
            "claim": (
                "The delivery bottleneck is time-limited: it primarily occurs on Friday "
                "evenings between 6-8 PM, and will partially resolve when Queen Street "
                "construction ends. Rerouting deliveries through alternative streets on "
                "Friday evenings could reduce delays by an estimated 40-60%."
            ),
            "confidence": 0.71,
            "supporting_submissions": ["sub_driver", "sub_resident"],
            "cross_validated": True,
            "novel": True,
            "reasoning": (
                "Driver's observation pins congestion to Fridays 6-8 PM specifically. "
                "Resident's information about construction being temporary (since October) "
                "implies the compound effect will diminish. Combined, this suggests a "
                "time-bounded problem with a predictable resolution timeline."
            ),
        },
        {
            "claim": (
                "Restaurant Bella on King Street has inherently slower preparation times "
                "on Friday evenings, independent of traffic conditions."
            ),
            "confidence": 0.55,
            "supporting_submissions": ["sub_courier"],
            "cross_validated": False,
            "novel": False,
            "reasoning": (
                "Based on courier's report alone. The 35-minute wait could be partly "
                "due to higher order volume on Fridays, not just traffic-related delays. "
                "Additional courier observations would be needed to separate restaurant "
                "preparation time from delivery pickup delays."
            ),
        },
    ],
    "correlations_discovered": [
        {
            "between": ["sub_courier", "sub_driver"],
            "relationship": (
                "Courier's restaurant wait time spike on Fridays correlates with "
                "driver's observed traffic congestion pattern — both peak at the same "
                "time window (6-8 PM), suggesting traffic delays cascade into longer "
                "restaurant queue times as multiple couriers arrive late."
            ),
            "strength": "strong",
        },
        {
            "between": ["sub_driver", "sub_resident"],
            "relationship": (
                "Driver's Friday congestion on King Street is amplified by resident's "
                "reported construction diversion from Queen Street — the construction "
                "forces additional traffic onto the same street where the market operates, "
                "creating a compounding effect."
            ),
            "strength": "strong",
        },
        {
            "between": ["sub_courier", "sub_resident"],
            "relationship": (
                "Courier's delivery delays may worsen as long as construction continues. "
                "When construction ends, the traffic diversion will stop, likely reducing "
                "Friday evening delays even with the market still running."
            ),
            "strength": "moderate",
        },
    ],
    "limitations": [
        "Only 3 observations — more data points would increase confidence",
        "No direct measurement of delivery completion times, only wait times",
        "Construction end date is unknown — the temporal prediction depends on it",
        "Observations are from a single area; adjacent neighbourhoods may differ",
    ],
    "data_quality": {
        "total_sources": 3,
        "cross_validated_pairs": 3,
        "novel_findings_count": 2,
        "overall_confidence": 0.72,
    },
}

ATTRIBUTION_RESULT = {
    "attributions": [
        {
            "contributor_id": "demo-contributor-001",
            "submission_ids": ["sub_courier"],
            "marginal_contribution": 0.40,
            "reason": (
                "Provided the only direct observation of restaurant wait times — "
                "the core delivery metric. Removing this data eliminates the ability "
                "to quantify the actual impact on delivery operations and weakens "
                "the first (highest confidence) finding."
            ),
            "payout_usd": 32.00,
        },
        {
            "contributor_id": "demo-contributor-002",
            "submission_ids": ["sub_driver"],
            "marginal_contribution": 0.35,
            "reason": (
                "Identified the street market as the primary traffic cause and "
                "pinpointed the exact time window. This data is critical to both "
                "novel findings and forms the strongest correlation pair with the "
                "courier data."
            ),
            "payout_usd": 28.00,
        },
        {
            "contributor_id": "demo-contributor-003",
            "submission_ids": ["sub_resident"],
            "marginal_contribution": 0.25,
            "reason": (
                "Provided the construction diversion information that transforms "
                "the analysis from a single-cause explanation to a compound-effect "
                "discovery. Without this, the second novel finding (time-limited "
                "bottleneck) would not exist."
            ),
            "payout_usd": 20.00,
        },
    ],
    "method_notes": (
        "Attribution computed via leave-one-out analysis. Each contributor's data "
        "was removed and the fusion re-evaluated. The courier's data has highest "
        "marginal value because it provides the only direct delivery metric. The "
        "driver's data is critical for the main correlation. The resident's data, "
        "while contributing the fewest findings, enables the novel compound-effect "
        "discovery that distinguishes this product from a simple traffic report."
    ),
    "platform_fee": 20.00,
    "total_budget": 100.00,
}
