import { createClient } from "@/utils/supabase/server";

type OrderRequest = {
  customerName?: unknown;
  phone?: unknown;
  fulfillmentMethod?: unknown;
  salesChannel?: unknown;
  paymentMethod?: unknown;
  company?: unknown;
  email?: unknown;
  address?: unknown;
  notes?: unknown;
  items?: unknown;
};

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let body: OrderRequest;
  try {
    body = (await request.json()) as OrderRequest;
  } catch {
    return Response.json({ error: "The order request is invalid." }, { status: 400 });
  }

  const customerName = textValue(body.customerName, 120);
  const phone = textValue(body.phone, 40);
  const fulfillmentMethod = textValue(body.fulfillmentMethod, 30);
  const salesChannel = textValue(body.salesChannel, 30);
  const paymentMethod = textValue(body.paymentMethod, 30);
  const company = textValue(body.company, 160);
  const email = textValue(body.email, 254);
  const address = textValue(body.address, 500);
  const notes = textValue(body.notes, 1000);

  if (
    !customerName ||
    !phone ||
    !["wholesale", "retail"].includes(salesChannel) ||
    !["home_delivery", "store_pickup"].includes(fulfillmentMethod) ||
    !["pay_later", "moyasar"].includes(paymentMethod) ||
    (fulfillmentMethod === "home_delivery" && !address) ||
    !Array.isArray(body.items)
  ) {
    return Response.json(
      { error: "Choose a fulfilment method, provide required contact details, and add basket items." },
      { status: 400 }
    );
  }

  const items = body.items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const line = item as { productId?: unknown; quantity?: unknown };
    if (
      typeof line.productId !== "string" ||
      !Number.isInteger(line.quantity) ||
      Number(line.quantity) < 1 ||
      Number(line.quantity) > 10000
    ) {
      return [];
    }
    return [{ productId: line.productId, quantity: Number(line.quantity) }];
  });

  if (items.length !== body.items.length || items.length === 0) {
    return Response.json(
      { error: "One or more basket items are invalid." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_store_order", {
    p_customer_name: customerName,
    p_phone: phone,
    p_items: items,
    p_sales_channel: salesChannel,
    p_fulfillment_method: fulfillmentMethod,
    p_payment_method: paymentMethod,
    p_company: company || null,
    p_email: email || null,
    p_address: address || null,
    p_notes: notes || null,
  });

  if (error) {
    if (error.code === "P0001") {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (["PGRST202", "PGRST203", "PGRST204"].includes(error.code ?? "")) {
      console.error("Store order schema is not ready:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return Response.json(
        {
          error:
            "Store database setup is incomplete. Run 20261027000003_store_channels.sql in Supabase SQL Editor, then reload the schema cache.",
        },
        { status: 503 }
      );
    }

    if (error.code === "42703") {
      console.error(`Order table setup is incomplete [${error.code}]: ${error.message}`);
      return Response.json(
        {
          error:
            "Order database columns are incomplete. Rerun 20261027000003_store_channels.sql in Supabase SQL Editor, then reload the schema cache.",
        },
        { status: 503 }
      );
    }

    if (error.code === "23502") {
      console.error(`Order is missing a required field [${error.code}]: ${error.message}`);
      if (error.message?.includes('"delivery_address"')) {
        return Response.json(
          {
            error:
              "Supabase still requires a delivery address for store pickup. In SQL Editor run: ALTER TABLE public.orders ALTER COLUMN delivery_address DROP NOT NULL; then reload the schema cache.",
          },
          { status: 503 }
        );
      }
      if (error.message?.includes('"city"')) {
        return Response.json(
          {
            error:
              "Supabase still requires a city value for this order. Rerun the updated 20261027000003_store_channels.sql migration, then reload the schema cache.",
          },
          { status: 503 }
        );
      }
      return Response.json(
        { error: "A required order detail is missing. Check the contact and fulfilment fields, then retry." },
        { status: 400 }
      );
    }

    if (error.code === "23514" && error.message?.includes("orders_payment_method_check")) {
      console.error(`Legacy payment method check rejected checkout [${error.code}]: ${error.message}`);
      return Response.json(
        {
          error:
            "Supabase has an outdated payment-method rule. Run 20261027000004_order_compatibility.sql in SQL Editor, then retry.",
        },
        { status: 503 }
      );
    }

    if (error.code === "23514" && error.message?.includes("orders_payment_status_check")) {
      console.error(`Legacy payment status check rejected checkout [${error.code}]: ${error.message}`);
      return Response.json(
        {
          error:
            "Supabase has an outdated payment-status rule. Rerun 20261027000004_order_compatibility.sql in SQL Editor, then retry.",
        },
        { status: 503 }
      );
    }

    console.error(
      `Store order creation failed [${error.code ?? "unknown"}]: ${error.message}`
    );
    return Response.json(
      { error: "We could not submit your order. Please try again shortly." },
      { status: 500 }
    );
  }

  const result = data as unknown as { orderId?: string; total?: number };
  if (!result?.orderId) {
    console.error("Wholesale order RPC returned an unexpected response.");
    return Response.json(
      { error: "We could not confirm your order. Please contact the store." },
      { status: 500 }
    );
  }

  return Response.json(
    {
      orderId: result.orderId,
      total: Number(result.total ?? 0),
      salesChannel,
      paymentMethod,
      paymentEnabled: Boolean(
        process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY &&
          process.env.MOYASAR_SECRET_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
    { status: 201 }
  );
}