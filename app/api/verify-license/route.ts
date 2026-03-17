import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { license_key } = await req.json();

    const response = await fetch(process.env.LICENSE_VERIFY_URL!, {
      method: "POST",
      body: JSON.stringify({
        action: "verify",
        license_key
      })
    });

    const data = await response.json();

    return NextResponse.json(data);

  } catch (err) {
    return NextResponse.json(
      { valid: false, error: String(err) },
      { status: 500 }
    );
  }
}