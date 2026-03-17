import Stripe from "stripe";
import { headers } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function generateLicenseKey() {
  return "ANK-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // 🎯 PAYMENT SUCCESS
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const email = session.customer_details?.email;

    if (!email) {
      console.error("No email found on session");
      return new Response("Missing email", { status: 400 });
    }

    const licenseKey = generateLicenseKey();

    console.log("💰 Payment success:", email);
    console.log("🔑 Generated key:", licenseKey);

    // 🔥 CALL GOOGLE SCRIPT
    try {
      await fetch(process.env.LICENSE_VERIFY_URL!, {
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

      console.log("✅ Licence stored + email sent");

    } catch (err) {
      console.error("❌ Failed to store licence:", err);
    }
  }

  return new Response("OK", { status: 200 });
}