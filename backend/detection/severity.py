"""
NetWatch Backend — Severity scoring and alert categorisation utilities.

Combines results from stage 1 (statistical) and stage 2 (ML) into a
final severity and category for each alert.
"""

_SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def higher_severity(a: str, b: str) -> str:
    """Return the more severe of two severity levels."""
    return a if _SEVERITY_ORDER.get(a, 0) >= _SEVERITY_ORDER.get(b, 0) else b


def combine_stages(
    stat_result: dict,
    ml_result: dict | None,
) -> tuple[str, str, str]:
    """
    Merge stage 1 and stage 2 results into final (category, severity, stage).

    Returns:
        category: The attack category label
        severity: The final severity level
        stage: "statistical", "ml", or "both"
    """
    stat_triggered = stat_result.get("anomalous", False)
    ml_triggered = ml_result is not None and ml_result.get("anomalous", False)

    if stat_triggered and ml_triggered:
        severity = higher_severity(stat_result["severity"], ml_result["severity"])
        # Prefer the ML category when both fire (more specific)
        category = ml_result["category"] or stat_result["category"]
        return category, severity, "both"

    if ml_triggered:
        return ml_result["category"], ml_result["severity"], "ml"

    if stat_triggered:
        return stat_result["category"], stat_result["severity"], "statistical"

    return "", "", ""
