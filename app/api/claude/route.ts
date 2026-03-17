import { NextResponse } from "next/server";

const CLAUDE_MODEL = "claude-sonnet-4-0";

export async function POST(req: Request) {
  try {
    const { prompt, systemPrompt, apiKey: clientApiKey } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: { message: "Missing prompt" } },
        { status: 400 }
      );
    }

    const apiKey = clientApiKey || process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: "Missing Claude API key" } },
        { status: 400 }
      );
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json({ error: data }, { status: upstream.status });
    }

    const text =
      data?.content?.find?.((part: any) => part?.type === "text")?.text ?? "No response";

    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}