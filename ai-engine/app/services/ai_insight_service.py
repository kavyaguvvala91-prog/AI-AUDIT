from .llm_router import LLMRouter


class AIInsightService:
    def __init__(self):
        self.router = LLMRouter()

    def summarize(self, context: dict, preferred_provider: str | None = None, mode: str = "governance") -> dict:
        return self.router.generate(context, preferred_provider=preferred_provider, mode=mode)

    def remediation_summary(self, context: dict, preferred_provider: str | None = None) -> dict:
        return self.summarize(context, preferred_provider=preferred_provider, mode="remediation")

    def governance_summary(self, context: dict, preferred_provider: str | None = None) -> dict:
        return self.summarize(context, preferred_provider=preferred_provider, mode="governance")
