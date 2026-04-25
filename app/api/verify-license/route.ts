import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { license_key } = await req.json();
    const response = await fetch("https://layerbuzz.ayteelabs.com/api/licences/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: license_key }),
    });
    const data = await response.json();
    return NextResponse.json({ valid: data.valid });
  } catch (err) {
    return NextResponse.json({ valid: false, error: String(err) }, { status: 500 });
  }
}