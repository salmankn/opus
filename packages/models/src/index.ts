// Model Router (§17-18): provider-independent, free-first for $0 budget.
// Order: free cloud quotas (Gemini/OpenRouter-free/HF) -> Ollama local -> mock.
export type Capability = "planning" | "coding" | "extraction" | "verification" | "fast";
export interface RouteDecision { provider: string; model: string; reason: string; }

export function routeModel(capability: Capability): RouteDecision {
  if (process.env.GEMINI_API_KEY) {
    return { provider: "gemini", model: capability === "coding" ? "gemini-2.0-flash" : "gemini-2.0-flash-lite", reason: "free-tier cloud quota" };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", reason: "openrouter :free model" };
  }
  if (process.env.HF_TOKEN) {
    return { provider: "huggingface", model: "HuggingFaceH4/zephyr-7b-beta", reason: "hf inference free" };
  }
  if (process.env.OLLAMA_BASE_URL) {
    const model = capability === "coding" ? "qwen2.5-coder:7b" : capability === "verification" ? "mistral:7b" : "llama3.1:8b";
    return { provider: "ollama", model, reason: "local free fallback" };
  }
  return { provider: "mock", model: "mock-planner-1", reason: "offline deterministic plan (no spend)" };
}
