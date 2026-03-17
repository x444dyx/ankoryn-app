import { NextResponse } from "next/server";

const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function POST(req: Request) {

  try {

    const { prompt, systemPrompt, model } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: { message: "Missing prompt" } },
        { status: 400 }
      );
    }

    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    const upstream = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model ?? "llama3.2",
        prompt: fullPrompt,
        stream: false
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data },
        { status: upstream.status }
      );
    }

    const text = data?.response ?? "No response";

    return NextResponse.json({ text });

  } catch (err: any) {

    return NextResponse.json(
      { error: { message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );

  }

}