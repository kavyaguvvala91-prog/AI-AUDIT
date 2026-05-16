def remediation_prompt(context: dict) -> str:
    return (
        "You are an enterprise AI governance analyst.\n"
        "Explain the detected AI risks in plain business language.\n"
        "Cover drift, fairness, anomalies, confidence, data quality, training risks, and remediation actions when present.\n"
        "For each major issue, say what happened, why it matters, and what action should be taken.\n"
        "End with a short remediation summary and whether auto-fix should be approved.\n\n"
        f"Context:\n{context}"
    )


def governance_prompt(context: dict) -> str:
    return (
        "You are generating an AI governance report.\n"
        "Summarize model health, risk severity, monitoring findings, fairness, anomalies, confidence, retraining readiness, and recommended corrective actions.\n"
        "Keep the tone executive-friendly and concrete.\n"
        "Call out the highest-risk issue first, then the most important next action.\n\n"
        f"Context:\n{context}"
    )
