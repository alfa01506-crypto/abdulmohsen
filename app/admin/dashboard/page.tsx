
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const { data: { user }, error: userError } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/admin");
        return;
      }

      setEmail(user.email ?? "");

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

      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        setMessage("Order വിവരങ്ങൾ ലഭിച്ചില്ല. Database policies പരിശോധിക്കണം.");
      } else {
        setOrders((data ?? []) as Order[]);
      }

      setLoading(false);
    }

    void loadDashboard();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Dashboard തുറക്കുന്നു...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-white sm:p-10">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-yellow-500">
            Abdul Mohsen Wholesale Bookstore
          </p>
          <h1 className="mt-2 text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-400">{email}</p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Logout
        </button>
      </header>

      <section className="mx-auto mt-10 max-w-6xl">
        <h2 className="text-xl font-semibold">Store Overview</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-400">Recent Orders</p>
            <p className="mt-2 text-3xl font-bold">{orders.length}</p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-400">Store</p>
            <p className="mt-2 text-xl font-bold text-yellow-500">Connected</p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-400">Account</p>
            <p className="mt-2 break-words text-lg font-semibold">Admin</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-xl font-semibold">Latest Orders</h2>

          {message && (
            <p role="alert" className="mt-4 text-sm text-amber-400">
              {message}
            </p>
          )}

          {!message && orders.length === 0 && (
            <p className="mt-4 text-neutral-400">
              ഇതുവരെ order ഒന്നും ലഭിച്ചിട്ടില്ല.
            </p>
          )}

          {orders.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="text-neutral-400">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-neutral-800">
                      <td className="p-3">{order.id.slice(0, 8)}</td>
                      <td className="p-3">{order.status}</td>
                      <td className="p-3">
                        SAR {Number(order.total_amount).toFixed(2)}
                      </td>
                      <td className="p-3">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
