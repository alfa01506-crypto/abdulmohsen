
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Order = {
  id: string | number;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  company?: string | null;
  delivery_address?: string | null;
  fulfillment_method?: "home_delivery" | "store_pickup" | null;
  payment_method?: "pay_later" | "moyasar" | null;
  payment_status?: "unpaid" | "pending" | "paid" | "failed" | null;
  sales_channel?: "wholesale" | "retail" | null;
  notes?: string | null;
  items?: Array<{
    productId?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    subtotal?: number;
  }> | null;
};

type RevenueOrder = {
  id: string | number;
  total: number | null;
  payment_status: string | null;
  created_at: string | null;
  customer_phone: string | null;
};

type StockProduct = {
  id: string;
  name: string;
  category: string | null;
  stock: number;
};

function saudiDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function saudiMonthStart(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000);
}

const formatSar = (amount: number) =>
  new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(amount);

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [revenueOrders, setRevenueOrders] = useState<RevenueOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<StockProduct[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [statusEdits, setStatusEdits] = useState<Record<string, string>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [paymentUpdatingOrderId, setPaymentUpdatingOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [reportDate, setReportDate] = useState<Date | null>(null);

  useEffect(() => {
    queueMicrotask(() => setReportDate(new Date()));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/admin");
          return;
        }

        const { data: admin, error: adminError } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminError || !admin) {
          await supabase.auth.signOut();
          router.replace("/admin");
          return;
        }

        const [{ data, error: ordersError }, { data: lowStockData }] = await Promise.all([
          supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
          supabase
            .from("products")
            .select("id, name, category, stock")
            .eq("is_active", true)
            .lte("stock", 10)
            .order("stock")
            .limit(8),
        ]);

        const monthOrders: RevenueOrder[] = [];
        let pageStart = 0;
        while (true) {
          const { data: page, error: pageError } = await supabase
            .from("orders")
            .select("id, total, payment_status, created_at, customer_phone")
            .gte("created_at", saudiMonthStart(new Date()).toISOString())
            .order("created_at", { ascending: false })
            .range(pageStart, pageStart + 499);

          if (pageError) {
            setMessage("Revenue report could not be loaded: " + pageError.message);
            break;
          }

          monthOrders.push(...((page ?? []) as RevenueOrder[]));
          if (!page || page.length < 500) break;
          pageStart += 500;
        }

        if (!active) return;

        if (ordersError) {
          setMessage("Orders load cheyyan kazhinjilla: " + ordersError.message);
        } else {
          setOrders((data ?? []) as Order[]);
          setRevenueOrders(monthOrders);
          setLowStockProducts((lowStockData ?? []) as StockProduct[]);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Dashboard load cheyyan kazhinjilla."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage("Logout failed: " + error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  async function updateOrderStatus(order: Order) {
    const orderId = String(order.id);
    const nextStatus = statusEdits[orderId] ?? order.status ?? "pending";
    setUpdatingOrderId(orderId);
    setMessage("");

    const supabase = createClient();
    const { error: updateError } = await supabase.rpc(
      "update_wholesale_order_status",
      { p_order_id: orderId, p_status: nextStatus }
    );

    if (updateError) {
      setMessage("Order status could not be updated: " + updateError.message);
      setUpdatingOrderId(null);
      return;
    }

    setOrders((current) =>
      current.map((item) =>
        String(item.id) === orderId ? { ...item, status: nextStatus } : item
      )
    );
    setMessage(`Order #${orderId} updated to ${nextStatus}.`);
    setUpdatingOrderId(null);
  }

  async function updatePaymentStatus(order: Order, nextPaymentStatus: "paid" | "unpaid") {
    const orderId = String(order.id);
    setPaymentUpdatingOrderId(orderId);
    setMessage("");

    const supabase = createClient();
    const { error: paymentError } = await supabase.rpc(
      "admin_set_manual_payment_status",
      { p_order_id: orderId, p_payment_status: nextPaymentStatus }
    );

    if (paymentError) {
      setMessage("Payment status could not be updated: " + paymentError.message);
      setPaymentUpdatingOrderId(null);
      return;
    }

    setOrders((current) =>
      current.map((item) =>
        String(item.id) === orderId
          ? { ...item, payment_status: nextPaymentStatus }
          : item
      )
    );
    setRevenueOrders((current) =>
      current.map((item) =>
        String(item.id) === orderId
          ? { ...item, payment_status: nextPaymentStatus }
          : item
      )
    );
    setMessage(`Order #${orderId} payment marked ${nextPaymentStatus}.`);
    setPaymentUpdatingOrderId(null);
  }

  const todayKey = reportDate ? saudiDateKey(reportDate) : "";
  const paidOrders = revenueOrders.filter((order) => order.payment_status === "paid");
  const todayRevenue = paidOrders
    .filter((order) => order.created_at && saudiDateKey(new Date(order.created_at)) === todayKey)
    .reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const monthRevenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  );
  const monthCustomers = new Set(
    revenueOrders.map((order) => order.customer_phone).filter(Boolean)
  ).size;
  const searchTerm = search.trim().toLowerCase();
  const visibleOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    return [
      order.id,
      order.customer_name,
      order.customer_phone,
      order.company,
      order.customer_email,
      order.sales_channel,
    ].some((value) => String(value ?? "").toLowerCase().includes(searchTerm));
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f2e9] text-[#172b24]">
        Dashboard തുറക്കുന്നു...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2e9] p-6 text-[#172b24]">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#54725d]">
              Abdul Mohsen
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#68776d]">
              Store management panel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-[#174333] no-underline hover:underline">
              View store
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md border border-[#cdd8ce] px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        <section className="border-y border-[#d5dfd5] bg-white px-5 py-6 sm:px-7">
          <h2 className="font-serif text-2xl font-semibold">Store Management</h2>
          <p className="mt-2 text-sm text-[#68776d]">
            Products add cheyyanum stock manage cheyyanum thazhe click cheyyuka.
          </p>

          <Link
            href="/admin/products"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-[#174333] px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-[#235b46]"
          >
            Manage Products →
          </Link>
          <Link
            href="/track-order"
            className="ml-4 inline-flex items-center justify-center rounded-md border border-[#cdd8ce] px-5 py-3 text-sm font-semibold text-[#174333] no-underline hover:bg-[#f4f7ed]"
          >
            Preview order tracking →
          </Link>
        </section>

        <section className="grid gap-px border-y border-[#d5dfd5] bg-[#d5dfd5] sm:grid-cols-2 lg:grid-cols-4">
          <article className="bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#68776d]">Paid today</p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#174333]">{formatSar(todayRevenue)}</p>
          </article>
          <article className="bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#68776d]">Paid this month</p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#174333]">{formatSar(monthRevenue)}</p>
          </article>
          <article className="bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#68776d]">Paid orders this month</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{paidOrders.length}</p>
          </article>
          <article className="bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#68776d]">Customers this month</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{monthCustomers}</p>
          </article>
        </section>

        <section className="border-y border-[#d5dfd5] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold">Low stock</h2>
            <Link href="/admin/products" className="text-sm font-semibold text-[#174333] no-underline hover:underline">
              Update stock →
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="mt-3 text-sm text-[#68776d]">No active products at or below 10 units.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {lowStockProducts.map((product) => (
                <li key={product.id} className="flex justify-between gap-3 border-t border-[#e1e8df] py-2 text-sm">
                  <span className="truncate">{product.name}</span>
                  <strong className={product.stock <= 3 ? "text-red-700" : "text-[#8b6722]"}>
                    {product.stock} left
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        {message && (
          <p className="break-words border-l-2 border-[#d1a24b] bg-white p-4 text-sm text-[#47554b]">
            {message}
          </p>
        )}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Order requests</h2>
              <p className="mt-1 text-xs text-[#68776d]">Revenue reports include paid orders only.</p>
            </div>
            <label className="w-full max-w-sm">
              <span className="sr-only">Search orders or customers</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, customer, phone or company"
                className="h-10 w-full rounded-md border border-[#d3ddd4] bg-white px-3 text-sm outline-none focus:border-[#174333]"
              />
            </label>
          </div>

          {!message && visibleOrders.length === 0 && (
            <div className="border-y border-[#d5dfd5] bg-white p-5">
              <p className="text-[#68776d]">
                {searchTerm ? "No matching orders." : "No order requests have been received yet."}
              </p>
            </div>
          )}

          {visibleOrders.map((order) => (
            <article
              key={order.id}
              className="border-y border-[#d5dfd5] bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#172b24]">Order #{order.id}</h3>
                  <p className="mt-1 text-sm text-[#68776d]">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString()
                      : "Date unavailable"}
                  </p>
                  {order.customer_name && (
                    <p className="mt-3 text-sm text-[#44564a]">
                      {order.customer_name}
                      {order.company ? ` · ${order.company}` : ""}
                    </p>
                  )}
                  {order.sales_channel && (
                    <p className="mt-1 text-xs font-semibold uppercase text-[#54725d]">
                      {order.sales_channel} order
                    </p>
                  )}
                  {order.customer_phone && (
                    <p className="mt-1 text-sm text-[#68776d]">
                      <a className="text-[#174333]" href={`tel:${order.customer_phone}`}>
                        {order.customer_phone}
                      </a>
                      {order.customer_email ? ` · ${order.customer_email}` : ""}
                    </p>
                  )}
                  {order.delivery_address && (
                    <p className="mt-1 text-sm text-[#68776d]">Delivery: {order.delivery_address}</p>
                  )}
                  {order.fulfillment_method && (
                    <p className="mt-1 text-sm text-[#54725d]">
                      {order.fulfillment_method === "home_delivery"
                        ? "Home delivery"
                        : "Store pickup"}
                    </p>
                  )}
                  {order.payment_method && (
                    <p className="mt-1 text-sm text-[#68776d]">
                      Payment: {order.payment_method === "moyasar" ? "Moyasar card" : "Pay on confirmation"}
                      {order.payment_status ? ` · ${order.payment_status}` : ""}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {order.total != null && (
                    <p className="font-semibold text-[#174333]">
                      {order.total} SAR
                    </p>
                  )}
                  {order.status && (
                    <p className="mt-1 text-sm text-[#68776d]">
                      Current status: {order.status}
                    </p>
                  )}
                </div>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="mt-4 border-t border-[#e1e8df] pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-[#68776d]">Items</p>
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div key={`${item.productId ?? item.name}-${index}`} className="flex justify-between gap-3 text-sm text-[#44564a]">
                        <span>{item.name ?? "Product"} × {item.quantity ?? 0}</span>
                        <span>{item.subtotal ?? (item.unitPrice ?? 0) * (item.quantity ?? 0)} SAR</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {order.notes && (
                <p className="mt-3 text-sm text-[#68776d]">Note: {order.notes}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e1e8df] pt-3">
                <label htmlFor={`status-${order.id}`} className="text-xs text-[#68776d]">
                  Update status
                </label>
                <select
                  id={`status-${order.id}`}
                  value={statusEdits[String(order.id)] ?? order.status ?? "pending"}
                  onChange={(event) => setStatusEdits((current) => ({
                    ...current,
                    [String(order.id)]: event.target.value,
                  }))}
                  className="rounded-md border border-[#d3ddd4] bg-white px-3 py-2 text-sm text-[#172b24]"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled" disabled={order.payment_status === "paid"}>
                    {order.payment_status === "paid" ? "Refund before cancelling" : "Cancelled"}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => void updateOrderStatus(order)}
                  disabled={updatingOrderId === String(order.id)}
                  className="rounded-md bg-[#174333] px-3 py-2 text-sm font-semibold text-white hover:bg-[#235b46] disabled:opacity-50"
                >
                  {updatingOrderId === String(order.id) ? "Saving..." : "Save status"}
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(order)}
                  className="rounded-md border border-[#cdd8ce] px-3 py-2 text-sm font-medium text-[#174333] hover:bg-white"
                >
                  Invoice / print
                </button>
                {order.payment_method !== "moyasar" && order.payment_status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => void updatePaymentStatus(order, "paid")}
                    disabled={paymentUpdatingOrderId === String(order.id)}
                    className="rounded-md border border-[#9eb8a3] px-3 py-2 text-sm font-medium text-[#174333] hover:bg-[#f4f7ed] disabled:opacity-50"
                  >
                    {paymentUpdatingOrderId === String(order.id) ? "Saving..." : "Mark paid"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>

        {invoiceOrder && (
          <div className="invoice-overlay fixed inset-0 z-[70] overflow-y-auto bg-[#10271dcc] p-4 sm:p-8">
            <section className="invoice-print mx-auto max-w-3xl border border-[#d5dfd5] bg-white p-6 shadow-2xl sm:p-10">
              <div className="no-print mb-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-md bg-[#174333] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235b46]"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  className="rounded-md border border-[#d3ddd4] px-4 py-2 text-sm"
                >
                  Close
                </button>
              </div>
              <header className="flex flex-wrap justify-between gap-5 border-b border-[#dfe6dd] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#54725d]">Saudi Arabia</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">Abdul Mohsen Stationery Mart</h2>
                  <p className="mt-1 text-sm text-[#68776d]">Order invoice</p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-semibold">Order #{invoiceOrder.id}</p>
                  <p className="mt-1 text-[#68776d]">
                    {invoiceOrder.created_at
                      ? new Date(invoiceOrder.created_at).toLocaleString("en-SA", { timeZone: "Asia/Riyadh" })
                      : "Date unavailable"}
                  </p>
                  <p className="mt-1 text-[#68776d]">{invoiceOrder.sales_channel ?? "Store"} · {invoiceOrder.status ?? "pending"}</p>
                </div>
              </header>
              <section className="grid gap-4 border-b border-[#dfe6dd] py-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#68776d]">Customer</p>
                  <p className="mt-1 font-medium">{invoiceOrder.customer_name || "Customer"}</p>
                  {invoiceOrder.company && <p className="text-sm text-[#68776d]">{invoiceOrder.company}</p>}
                  {invoiceOrder.customer_phone && <p className="text-sm text-[#68776d]">{invoiceOrder.customer_phone}</p>}
                  {invoiceOrder.customer_email && <p className="text-sm text-[#68776d]">{invoiceOrder.customer_email}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#68776d]">Fulfilment &amp; payment</p>
                  <p className="mt-1 text-sm">{invoiceOrder.fulfillment_method === "store_pickup" ? "Store pickup" : "Home delivery"}</p>
                  {invoiceOrder.delivery_address && <p className="text-sm text-[#68776d]">{invoiceOrder.delivery_address}</p>}
                  <p className="text-sm text-[#68776d]">{invoiceOrder.payment_method === "moyasar" ? "Moyasar" : "Pay on confirmation"} · {invoiceOrder.payment_status ?? "unpaid"}</p>
                </div>
              </section>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#dfe6dd] text-left text-xs uppercase text-[#68776d]">
                    <th className="py-3 pr-3">Item</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Unit</th>
                    <th className="py-3 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceOrder.items ?? []).map((item, index) => (
                    <tr key={`${item.productId ?? item.name}-${index}`} className="border-b border-[#edf0ea]">
                      <td className="py-3 pr-3">{item.name ?? "Product"}</td>
                      <td className="px-3 py-3 text-right">{item.quantity ?? 0}</td>
                      <td className="px-3 py-3 text-right">{formatSar(item.unitPrice ?? 0)}</td>
                      <td className="py-3 pl-3 text-right">{formatSar(item.subtotal ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ml-auto mt-5 flex max-w-xs justify-between border-t border-[#dfe6dd] pt-4 text-base font-semibold">
                <span>Total</span>
                <span>{formatSar(Number(invoiceOrder.total ?? 0))}</span>
              </div>
              {invoiceOrder.notes && <p className="mt-5 text-sm text-[#68776d]">Note: {invoiceOrder.notes}</p>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
