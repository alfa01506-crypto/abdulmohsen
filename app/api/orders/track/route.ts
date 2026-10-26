import { createClient } from "@/utils/supabase/server";

type TrackRequest = { orderId?: unknown; phone?: unknown };

export async function POST(request: Request) {
  let body: TrackRequest;
  try {
    body = (await request.json()) as TrackRequest;
  } catch {
    return Response.json({ error: "Enter your order reference and phone number." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  if (!orderId || orderId.length > 80 || !phone) {
    return Response.json({ error: "Enter your order reference and phone number." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_store_order", {
    p_order_id: orderId,
    p_phone: phone,
  });

  if (error) {
    console.error("Order tracking failed:", error.code, error.message);
    return Response.json(
      { error: "Order tracking is not available yet. Please contact the store." },
      { status: 503 }
    );
  }

  if (!data) {
    return Response.json(
      { error: "We couldn't find an order with those details." },
      { status: 404 }
    );
  }

  return Response.json({ order: data });
}