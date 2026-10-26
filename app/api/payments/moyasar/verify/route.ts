import { createClient } from "@supabase/supabase-js";

type VerifyRequest = {
  orderId?: unknown;
  paymentId?: unknown;
};

type MoyasarPayment = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string> | null;
};

export async function POST(request: Request) {
  let body: VerifyRequest;
  try {
    body = (await request.json()) as VerifyRequest;
  } catch {
    return Response.json({ error: "Invalid payment callback." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(orderId) || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return Response.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  const secretKey = process.env.MOYASAR_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Payment verification is not configured on the server." },
      { status: 503 }
    );
  }

  const authorization = Buffer.from(`${secretKey}:`).toString("base64");
  let paymentResponse: Response;
  try {
    paymentResponse = await fetch(
      `https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authorization}`,
        },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );
  } catch (error) {
    console.error("Moyasar verification request failed:", error);
    return Response.json(
      { error: "We could not verify the payment. Please try again." },
      { status: 502 }
    );
  }

  if (!paymentResponse.ok) {
    console.error("Moyasar payment lookup failed:", paymentResponse.status);
    return Response.json(
      { error: "We could not verify the payment reference." },
      { status: 502 }
    );
  }

  const payment = (await paymentResponse.json()) as MoyasarPayment;
  if (payment.status !== "paid") {
    return Response.json({ paid: false, status: payment.status ?? "unknown" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total, payment_method, payment_status, payment_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    console.error("Paid Moyasar order lookup failed:", orderError);
    return Response.json({ error: "The order could not be verified." }, { status: 404 });
  }

  const expectedAmount = Math.round(Number(order.total) * 100);
  const metadataOrderId = payment.metadata?.order_id;
  if (
    order.payment_method !== "moyasar" ||
    payment.currency !== "SAR" ||
    payment.amount !== expectedAmount ||
    metadataOrderId !== String(order.id)
  ) {
    console.error("Moyasar payment did not match the order:", orderId, paymentId);
    return Response.json({ error: "The payment did not match this order." }, { status: 409 });
  }

  if (order.payment_status === "paid") {
    if (order.payment_id !== paymentId) {
      return Response.json({ error: "This order already has a verified payment." }, { status: 409 });
    }
    return Response.json({ paid: true, orderId: String(order.id) });
  }

  const { error: updateError } = await supabase.rpc(
    "confirm_moyasar_order_payment",
    { p_order_id: String(order.id), p_payment_id: paymentId }
  );

  if (updateError) {
    console.error("Could not mark order payment as paid:", updateError);
    return Response.json({ error: "Payment was received but could not be recorded." }, { status: 500 });
  }

  return Response.json({ paid: true, orderId: String(order.id) });
}