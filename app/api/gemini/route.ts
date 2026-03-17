import { NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(req: Request) {
  try {
    const { prompt, systemPrompt, apiKey: clientApiKey } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: { message: "Missing prompt" } },
        { status: 400 }
      );
    }

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: { message: "Missing Gemini API key" } },
        { status: 400 }
      );
    }

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          ...(systemPrompt
            ? {
                systemInstruction: {
                  parts: [{ text: systemPrompt }]
                }
              }
            : {})
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json({ error: data }, { status: upstream.status });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response";

    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}