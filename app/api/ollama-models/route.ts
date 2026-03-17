import { NextResponse } from "next/server";

export async function GET() {
  try {

    const res = await fetch("http://localhost:11434/api/tags");

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data },
        { status: res.status }
      );
    }

    const models =
      data?.models?.map((m: any) => m.name) ?? [];

    return NextResponse.json({ models });

  } catch (err: any) {

    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch models" },
      { status: 500 }
    );

  }
}