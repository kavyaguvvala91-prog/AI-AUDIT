const axios = require("axios");

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const buildPrompt = (context = {}) => {
  return [
    "You are an MLOps and responsible AI analyst.",
    "Summarize the situation in concise business language.",
    "Explain drift, bias, quality, retraining, and explainability signals when present.",
    "Finish with 3 practical recommendations.",
    "",
    "Context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
};

const generateWithOpenAI = async (context) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "You explain ML governance issues clearly and concretely." },
        { role: "user", content: buildPrompt(context) },
      ],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  return {
    provider: "openai",
    model: OPENAI_MODEL,
    text: response.data?.choices?.[0]?.message?.content?.trim() || "",
  };
};

const generateWithGemini = async (context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          parts: [{ text: buildPrompt(context) }],
        },
      ],
      generationConfig: { temperature: 0.2 },
    },
    { timeout: 15000 }
  );

  const text =
    response.data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim() || "";

  return {
    provider: "gemini",
    model: GEMINI_MODEL,
    text,
  };
};

const generateRuleBased = async (context = {}) => {
  const lines = [];
  const driftScore = context?.drift?.drift_score;
  const fairnessScore = context?.bias?.fairness_score;
  const qualityScore = context?.quality?.quality_score;
  const retrainingTriggered = context?.retraining?.triggered;
  const reasoning = context?.explanations?.reasoning || [];

  if (typeof driftScore === "number") {
    lines.push(
      driftScore >= 0.2
        ? `Model drift is elevated at ${driftScore}. Production data has meaningfully shifted from the baseline.`
        : `Model drift is controlled at ${driftScore}, so the baseline is still broadly representative.`
    );
  }

  if (typeof fairnessScore === "number") {
    lines.push(
      fairnessScore < 0.8
        ? `Fairness risk is visible with a fairness score of ${fairnessScore}. Group outcome parity should be reviewed.`
        : `Fairness signals are relatively stable with a score of ${fairnessScore}.`
    );
  }

  if (typeof qualityScore === "number") {
    lines.push(`Dataset quality is ${qualityScore}/100. Address missing values, duplicates, and outliers before retraining when possible.`);
  }

  if (retrainingTriggered) {
    lines.push("Automatic retraining produced a new model version, so the leaderboard and metric delta should be reviewed before promotion.");
  }

  if (reasoning.length) {
    lines.push(`Prediction reasoning highlights: ${reasoning.slice(0, 3).join("; ")}.`);
  }

  lines.push("Recommendations: 1. Monitor drift daily. 2. Review fairness gaps on sensitive groups. 3. Promote new versions only when metric gains are consistent.");

  return {
    provider: "rule-based",
    model: "local",
    text: lines.join(" "),
  };
};

const generateInsights = async (context, preferredProvider) => {
  const attempts =
    preferredProvider === "gemini"
      ? [generateWithGemini, generateWithOpenAI]
      : [generateWithOpenAI, generateWithGemini];

  for (const attempt of attempts) {
    try {
      const result = await attempt(context);
      if (result?.text) return result;
    } catch (_err) {
      // fall through to the next provider
    }
  }

  return generateRuleBased(context);
};

module.exports = {
  generateInsights,
};
