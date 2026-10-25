
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("Login പിശക്: " + error.message);
        return;
      }

      if (!data.user) {
        setMessage("ഉപയോക്തൃ വിവരങ്ങൾ ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError) {
        setMessage(
          "Admin അനുമതി പരിശോധിക്കാനായില്ല: " + adminError.message
        );
        await supabase.auth.signOut();
        return;
      }

      if (!admin) {
        setMessage(
          "Login വിജയിച്ചു. പക്ഷേ ഈ അക്കൗണ്ടിന് Admin അനുമതിയില്ല."
        );
        await supabase.auth.signOut();
        return;
      }

      window.location.href = "/admin/dashboard";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "അപ്രതീക്ഷിതമായ പിശക് സംഭവിച്ചു."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-5 rounded-2xl border border-yellow-700/40 bg-neutral-900 p-8 shadow-2xl"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-yellow-400">
            Abdul Mohsen
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Admin Login
          </p>
          <p className="text-sm text-neutral-500">
            Store management portal
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm">Email</label>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 outline-none focus:border-yellow-400"
            placeholder="Admin email"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 outline-none focus:border-yellow-400"
            placeholder="Password"
          />
        </div>

        {message && (
          <p
            role="alert"
            className="break-words rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-yellow-400 p-3 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "പരിശോധിക്കുന്നു..." : "Login"}
        </button>
      </form>
    </main>
  );
}
