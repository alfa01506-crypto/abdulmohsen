
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, isStepCount, streamText, tool } from "ai";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;
    const salesChannel =
      body.salesChannel === "retail" || body.salesChannel === "wholesale"
        ? body.salesChannel
        : null;

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Invalid chat messages." },
        { status: 400 }
      );
    }

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: `You are the customer-service assistant for Abdul Mohsen Stationery Mart in Saudi Arabia.
Reply in simple English or Manglish, matching the customer's language.
Help customers browse stationery, understand wholesale quantities, and prepare order requests.
Use searchProducts before answering questions about products, prices, or availability. Quote only the price label and amount returned for the current store channel. If no channel is selected, do not quote a price; direct the customer to choose Retail or Wholesale first. Never invent catalogue information.
Use addToCart only after finding the exact product in searchProducts, and state the product and quantity before asking the customer to confirm the add-to-basket action.
Do not claim an order has been placed; customers must submit the basket checkout form. Never collect payment details in chat.
When a customer wants to order or check out, use openCheckout to open the basket form so they can provide fulfilment details and submit it themselves.
For unsupported questions, direct customers to WhatsApp +966591767600.
Never reveal admin data, secrets, or private customer information.`,
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(4),
      tools: {
        searchProducts: tool({
          description:
            "Search active stationery products by name. Use this before giving product price or stock information; results include the price for the customer's current store channel.",
          inputSchema: z.object({
            query: z.string().min(1).max(100),
          }),
          execute: async ({ query }) => {
            const supabase = await createClient();
            const { data, error } = await supabase
              .from("products")
              .select("id, name, category, description, wholesale_price, retail_price, stock, min_order_quantity")
              .eq("is_active", true)
              .ilike("name", `%${query}%`)
              .limit(8);

            if (error) {
              console.error("Product search failed:", error);
              return [];
            }

            return (data ?? []).map((product) => ({
              id: product.id,
              name: product.name,
              category: product.category,
              description: product.description,
              price:
                salesChannel === "retail"
                  ? product.retail_price
                  : salesChannel === "wholesale"
                    ? product.wholesale_price
                    : null,
              priceLabel:
                salesChannel === "retail"
                  ? "Retail price"
                  : salesChannel === "wholesale"
                    ? "Wholesale price"
                    : null,
              stock: product.stock,
              min_order_quantity: product.min_order_quantity,
            }));
          },
        }),
        addToCart: tool({
          description:
            "Ask the customer to confirm adding a product found by searchProducts to their basket. This action requires customer approval in the chat UI.",
          inputSchema: z.object({
            productId: z.string(),
            productName: z.string().min(1).max(200),
            quantity: z.number().int().min(1).max(500),
          }),
        }),
        openCheckout: tool({
          description:
            "Open the customer's basket and order form when they want to place or submit an order. They must review all details and submit the order themselves.",
          inputSchema: z.object({}),
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (streamError) => {
        console.error("Chat stream error:", streamError);
        return "Our chat service is temporarily unavailable. Please try again later or contact Abdul Mohsen Stationery Mart on WhatsApp at +966591767600.";
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
