export type ModelProvider = "openai" | "gemini" | "claude" | "ollama" | "mistral";

const SYSTEM_PROMPT = "You are continuing a persistent AI workspace.";

async function sendOpenAI(prompt: string): Promise<string> {
  const key = localStorage.getItem("openai_key");
  if (!key) throw new Error("Missing OpenAI key.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? "OpenAI request failed";
    throw new Error(`OpenAI error: ${msg}`);
  }

  return data?.choices?.[0]?.message?.content ?? "No response";
}

async function sendGemini(prompt: string): Promise<string> {
  const key = localStorage.getItem("gemini_key");
  if (!key) throw new Error("Missing Gemini key.");

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      apiKey: key
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const msg =
      data?.error?.message ??
      JSON.stringify(data?.error ?? "Gemini request failed");
    throw new Error(`Gemini error: ${msg}`);
  }

  return data?.text ?? "No response";
}

async function sendOllama(prompt: string, model?: string): Promise<string> {
  const res = await fetch("/api/ollama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      model
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? "Ollama request failed";
    throw new Error(`Ollama error: ${msg}`);
  }

  return data?.text ?? "No response";
}

async function sendClaude(_prompt: string): Promise<string> {
  throw new Error("Claude is not wired up yet.");
}

async function sendMistral(prompt: string): Promise<string> {
  const key = localStorage.getItem("mistral_key");
  if (!key) throw new Error("Missing Mistral key.");

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? "Mistral request failed";
    throw new Error(`Mistral error: ${msg}`);
  }

  return data?.choices?.[0]?.message?.content ?? "No response";
}

export async function sendMessage(
  provider: ModelProvider,
  prompt: string,
  model?: string
): Promise<string> {

  switch (provider) {
    case "openai":
      return sendOpenAI(prompt);

    case "gemini":
      return sendGemini(prompt);

    case "ollama":
      return sendOllama(prompt, model);

    case "claude":
      return sendClaude(prompt);

    case "mistral":
      return sendMistral(prompt);

    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
  }
}