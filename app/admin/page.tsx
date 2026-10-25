
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProducts() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock")
        .order("name");

      if (error) {
        setMessage("Products load cheyyan kazhinjilla. Pinne try cheyyuka.");
      } else {
        setProducts((data ?? []) as Product[]);
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setMessage("Ee product ippol stock-il illa.");
      return;
    }

    setCart((current) => [...current, product]);
    setMessage(product.name + " cart-il add cheythu.");
  }

  function orderOnWhatsApp() {
    if (cart.length === 0) {
      setMessage("Aadyam oru product cart-il add cheyyuka.");
      return;
    }

    const items = cart
      .map(
        (product) =>
          `${product.name} - SAR ${Number(product.price).toFixed(2)}`
      )
      .join("\n");

    const total = cart.reduce(
      (sum, product) => sum + Number(product.price),
      0
    );

    const text =
      `Assalamu Alaikum, Abdul Mohsen Wholesale Bookstore-il order cheyyanam.\n\n` +
      `${items}\n\nTotal: SAR ${total.toFixed(2)}`;

    window.open(
      `https://wa.me/966591767600?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const total = cart.reduce(
    (sum, product) => sum + Number(product.price),
    0
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-yellow-700/40 px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-yellow-500">
              Abdul Mohsen
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Wholesale Bookstore
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Retail & Wholesale Books and Stationery
            </p>
          </div>

          <div className="rounded-xl border border-yellow-600/40 px-4 py-3">
            <p className="text-sm text-neutral-400">Cart items</p>
            <p className="text-xl font-bold text-yellow-400">{cart.length}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 rounded-2xl border border-yellow-700/30 bg-neutral-900 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-yellow-500">
            Welcome to our store
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold sm:text-5xl">
            Books and stationery for every need.
          </h2>
          <p className="mt-4 max-w-xl text-neutral-400">
            Browse products and send your order directly through WhatsApp.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Our Products</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-yellow-500 sm:w-72"
          />
        </div>

        {message && (
          <p className="mb-5 rounded-lg border border-yellow-700/40 bg-neutral-900 p-3 text-sm text-yellow-300">
            {message}
          </p>
        )}

        {loading ? (
          <p className="py-10 text-neutral-400">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
            <h3 className="text-lg font-semibold">No products to display</h3>
            <p className="mt-2 text-neutral-400">
              Admin panel vazhi products add cheythal ivide kaanam.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
              >
                <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-neutral-800 text-5xl">
                  📚
                </div>

                <h3 className="text-lg font-bold">{product.name}</h3>

                <p className="mt-4 text-xl font-bold text-yellow-400">
                  SAR {Number(product.price).toFixed(2)}
                </p>

                <p className="mt-1 text-sm text-neutral-400">
                  {product.stock > 0
                    ? `Stock: ${product.stock}`
                    : "Out of stock"}
                </p>

                <button
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="mt-5 w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  Add to Cart
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Your Cart</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {cart.length} item(s) selected
              </p>
            </div>

            <p className="text-xl font-bold text-yellow-400">
              SAR {total.toFixed(2)}
            </p>
          </div>

          <button
            onClick={orderOnWhatsApp}
            className="mt-5 w-full rounded-lg bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-500 sm:w-auto"
          >
            Order via WhatsApp
          </button>
        </div>
      </section>

      <footer className="border-t border-neutral-800 px-5 py-6 text-center text-sm text-neutral-500">
        © 2026 Abdul Mohsen Wholesale Bookstore
      </footer>
    </main>
  );
}
