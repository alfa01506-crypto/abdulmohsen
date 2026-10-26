
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

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [statusEdits, setStatusEdits] = useState<Record<string, string>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

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

        const { data, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!active) return;

        if (ordersError) {
          setMessage("Orders load cheyyan kazhinjilla: " + ordersError.message);
        } else {
          setOrders((data ?? []) as Order[]);
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
        </section>

        {message && (
          <p className="break-words border-l-2 border-[#d1a24b] bg-white p-4 text-sm text-[#47554b]">
            {message}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Order requests</h2>

          {!message && orders.length === 0 && (
            <div className="border-y border-[#d5dfd5] bg-white p-5">
              <p className="text-[#68776d]">No order requests have been received yet.</p>
            </div>
          )}

          {orders.map((order) => (
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
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
