import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const email = body?.data?.object?.customer_details?.email;

    if (!email) {
      return NextResponse.json(
        { error: "Missing customer email" },
        { status: 400 }
      );
    }

    const licenseKey = `ANK-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    await fetch(process.env.GOOGLE_SCRIPT_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  action: "create",
  email,
  license_key: licenseKey,
}),
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    );
  }
}