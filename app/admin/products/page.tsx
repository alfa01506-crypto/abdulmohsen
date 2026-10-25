
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [message, setMessage] = useState("ഉൽപ്പന്നങ്ങൾ പരിശോധിക്കുന്നു...");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, stock")
      .order("name");

    if (error) {
      setMessage("ഉൽപ്പന്നങ്ങൾ ലഭിച്ചില്ല: " + error.message);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setMessage("");
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function addProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("products").insert({
      name: name.trim(),
      price: Number(price),
      stock: Number(stock),
    });

    if (error) {
      setMessage("ചേർക്കാൻ കഴിഞ്ഞില്ല: " + error.message);
    } else {
      setName("");
      setPrice("");
      setStock("");
      setMessage("ഉൽപ്പന്നം വിജയകരമായി ചേർത്തു!");
      await loadProducts();
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <a
            href="/admin/dashboard"
            className="text-sm text-yellow-400"
          >
            ← Dashboard
          </a>
          <h1 className="mt-4 text-3xl font-bold text-yellow-400">
            Products Management
          </h1>
          <p className="mt-2 text-neutral-400">
            ഉൽപ്പന്നങ്ങളും സ്റ്റോക്കും നിയന്ത്രിക്കുക
          </p>
        </header>

        <form
          onSubmit={addProduct}
          className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
        >
          <h2 className="text-xl font-semibold">പുതിയ ഉൽപ്പന്നം ചേർക്കുക</h2>

          <div>
            <label className="mb-1 block text-sm">ഉൽപ്പന്നത്തിന്റെ പേര്</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              placeholder="ഉദാ: Notebook"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">വില (SAR)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">സ്റ്റോക്ക് എണ്ണം</label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-400 p-3 font-bold text-black disabled:opacity-50"
          >
            {loading ? "ചേർക്കുന്നു..." : "ഉൽപ്പന്നം ചേർക്കുക"}
          </button>

          {message && (
            <p role="status" className="break-words text-sm text-yellow-300">
              {message}
            </p>
          )}
        </form>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            ഉൽപ്പന്നങ്ങളുടെ പട്ടിക ({products.length})
          </h2>

          {products.map((product) => (
            <article
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-sm text-neutral-400">
                  വില: {product.price} SAR
                </p>
              </div>
              <p className="text-sm text-neutral-300">
                സ്റ്റോക്ക്: {product.stock}
              </p>
            </article>
          ))}

          {products.length === 0 && !message && (
            <p className="text-neutral-400">
              ഇതുവരെ ഉൽപ്പന്നങ്ങളൊന്നും ചേർത്തിട്ടില്ല.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
