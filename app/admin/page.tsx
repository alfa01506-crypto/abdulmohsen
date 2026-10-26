
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage(error?.message ?? "Login cheyyan kazhinjilla.");
      setLoading(false);
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      setMessage("Ee account admin list-il illa.");
      setLoading(false);
      return;
    }

    router.replace("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f2e9] px-5 text-[#172b24]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl border border-[#dce4da] bg-white p-8 shadow-[0_20px_60px_-35px_rgba(23,43,36,0.35)]"
      >
        <p className="text-xs font-semibold uppercase text-[#54725d]">
          Abdul Mohsen
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-sm text-[#68776d]">
          Store management panel
        </p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-[#174333] no-underline hover:underline">
          ← Back to store
        </Link>

        {message && (
          <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {message}
          </p>
        )}

        <label className="mt-6 block text-sm">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#d3ddd4] bg-white px-4 py-3 outline-none focus:border-[#174333] focus:ring-2 focus:ring-[#174333]/10"
          placeholder="Admin email"
        />

        <label className="mt-4 block text-sm">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#d3ddd4] bg-white px-4 py-3 outline-none focus:border-[#174333] focus:ring-2 focus:ring-[#174333]/10"
          placeholder="Password"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-[#174333] px-4 py-3 font-semibold text-white hover:bg-[#235b46] disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
