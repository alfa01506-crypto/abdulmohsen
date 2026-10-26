"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrackingOrder = {
  orderId: string;
  status: string;
  paymentStatus: string;
  fulfillmentMethod: string;
  salesChannel: string;
  createdAt: string;
  total: number;
  items: Array<{ name: string; quantity: number; subtotal: number }>;
};

const statusText: Record<string, { en: string; ar: string }> = {
  pending: { en: "Received", ar: "تم الاستلام" },
  confirmed: { en: "Confirmed", ar: "تم التأكيد" },
  fulfilled: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
};

export default function TrackOrderPage() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const arabic = language === "ar";

  useEffect(() => {
    const queryOrderId = new URLSearchParams(window.location.search).get("orderId");
    if (queryOrderId) queueMicrotask(() => setOrderId(queryOrderId));
  }, []);

  async function handleTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });
      const result = (await response.json()) as {
        order?: TrackingOrder;
        error?: string;
      };

      if (!response.ok || !result.order) {
        setError(result.error || "We couldn't find that order.");
      } else {
        setOrder(result.order);
      }
    } catch {
      setError("Order tracking is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const label = (key: string) => {
    const values: Record<string, { en: string; ar: string }> = {
      title: { en: "Track your order", ar: "تتبع طلبك" },
      intro: { en: "Enter the order reference and phone number used at checkout.", ar: "أدخل رقم الطلب ورقم الهاتف المستخدم عند الشراء." },
      orderId: { en: "Order reference", ar: "رقم الطلب" },
      phone: { en: "Phone number", ar: "رقم الهاتف" },
      submit: { en: "Find my order", ar: "ابحث عن طلبي" },
      status: { en: "Order status", ar: "حالة الطلب" },
      payment: { en: "Payment", ar: "الدفع" },
      fulfilment: { en: "Fulfilment", ar: "طريقة الاستلام" },
      home: { en: "Home delivery", ar: "توصيل للمنزل" },
      pickup: { en: "Store pickup", ar: "استلام من المتجر" },
      total: { en: "Order total", ar: "إجمالي الطلب" },
      items: { en: "Items", ar: "المنتجات" },
      back: { en: "Back to store", ar: "العودة إلى المتجر" },
    };
    return values[key]?.[language] ?? key;
  };

  return (
    <main dir={arabic ? "rtl" : "ltr"} className="min-h-screen bg-[#f4f2e9] px-4 py-8 text-[#172b24] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between border-b border-[#d5dfd5] pb-4">
          <Link href="/" className="font-serif text-lg font-semibold text-[#174333] no-underline">
            Abdul Mohsen Stationery Mart
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(arabic ? "en" : "ar")}
            className="rounded-md border border-[#cdd8ce] bg-white px-3 py-2 text-sm font-medium"
          >
            {arabic ? "English" : "العربية"}
          </button>
        </header>

        <section className="mt-10 border-y border-[#d5dfd5] bg-white p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase text-[#54725d]">Saudi Arabia · SAR</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">{label("title")}</h1>
          <p className="mt-2 text-sm leading-6 text-[#68776d]">{label("intro")}</p>

          <form onSubmit={handleTrack} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              {label("orderId")}
              <input
                required
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-[#d3ddd4] px-3 outline-none focus:border-[#174333]"
              />
            </label>
            <label className="block text-sm font-medium">
              {label("phone")}
              <input
                required
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-[#d3ddd4] px-3 outline-none focus:border-[#174333]"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-md bg-[#174333] px-5 text-sm font-semibold text-white hover:bg-[#235b46] disabled:opacity-50"
            >
              {loading ? "..." : label("submit")}
            </button>
          </form>

          {error && <p role="alert" className="mt-4 border-l-2 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          {order && (
            <section className="mt-7 border-t border-[#dfe6dd] pt-5" aria-live="polite">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl font-semibold">#{order.orderId}</h2>
                <p className="rounded-full bg-[#edf4ed] px-3 py-1 text-sm font-semibold text-[#174333]">
                  {statusText[order.status]?.[language] ?? order.status}
                </p>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <p><strong>{label("payment")}:</strong> {order.paymentStatus}</p>
                <p><strong>{label("fulfilment")}:</strong> {order.fulfillmentMethod === "store_pickup" ? label("pickup") : label("home")}</p>
                <p><strong>{label("total")}:</strong> {new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(order.total)}</p>
                <p><strong>{label("items")}:</strong> {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
              </div>
              <ul className="mt-4 divide-y divide-[#e1e8df] border-y border-[#e1e8df]">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex justify-between gap-3 py-3 text-sm">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-[#174333] no-underline hover:underline">
          {label("back")}
        </Link>
      </div>
    </main>
  );
}