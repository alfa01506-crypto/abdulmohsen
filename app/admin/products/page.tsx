
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Product = {
  id: string;
  name: string;
  price: number;
  retail_price: number;
  wholesale_price: number;
  stock: number;
  category: string;
  description: string;
  image_url: string | null;
  sku: string | null;
  min_order_quantity: number;
  is_active: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("Stationery");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sku, setSku] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("Loading products...");
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setProducts([]);
      setMessage("Login session illa. Admin login cheythu veendum try cheyyuka.");
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, retail_price, wholesale_price, stock, category, description, image_url, sku, min_order_quantity, is_active")
      .order("name");

    if (error) {
      setMessage("Products load failed: " + error.message);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setMessage("");
  }

  useEffect(() => {
    queueMicrotask(() => void loadProducts());
  }, []);

  async function addProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setMessage("Admin login session illa. Veendum login cheyyuka.");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        setMessage("Admin check failed: " + adminError.message);
        return;
      }

      if (!admin) {
        setMessage("Ee account admin list-il illa.");
        return;
      }

      const productName = name.trim();
      const productPrice = Number(price);
      const productRetailPrice =
        retailPrice.trim() === "" ? productPrice : Number(retailPrice);
      const productWholesalePrice =
        wholesalePrice.trim() === "" ? productPrice : Number(wholesalePrice);
      const productStock = Number(stock);
      const productMinimumOrder = Number(minimumOrder);

      if (!productName || price.trim() === "" || stock.trim() === "") {
        setMessage("Product name, price, and stock are required.");
        return;
      }

      if (
        !Number.isFinite(productPrice) ||
        productPrice < 0 ||
        !Number.isFinite(productRetailPrice) ||
        productRetailPrice < 0 ||
        !Number.isFinite(productWholesalePrice) ||
        productWholesalePrice < 0 ||
        !Number.isInteger(productStock) ||
        productStock < 0 ||
        !Number.isInteger(productMinimumOrder) ||
        productMinimumOrder < 1 ||
        (productStock > 0 && productMinimumOrder > productStock)
      ) {
        setMessage("Enter valid prices, stock, and a minimum order within available stock.");
        return;
      }

      const productData = {
        name: productName,
        price: productPrice,
        retail_price: productRetailPrice,
        wholesale_price: productWholesalePrice,
        stock: productStock,
        category: category.trim() || "Stationery",
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        sku: sku.trim() || null,
        min_order_quantity: productMinimumOrder,
        is_active: isActive,
      };

      const { error: saveError } = editingId
        ? await supabase.from("products").update(productData).eq("id", editingId)
        : await supabase.from("products").insert(productData);

      if (saveError) {
        setMessage("Product could not be saved: " + saveError.message);
        return;
      }

      setName("");
      setPrice("");
      setRetailPrice("");
      setWholesalePrice("");
      setStock("");
      setCategory("Stationery");
      setDescription("");
      setImageUrl("");
      setSku("");
      setMinimumOrder("1");
      setIsActive(true);
      setEditingId("");
      setMessage(editingId ? "Product updated." : "Product added.");

      await loadProducts();
    } catch (error) {
      setMessage(
        "Error: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setRetailPrice(String(product.retail_price));
    setWholesalePrice(String(product.wholesale_price));
    setStock(String(product.stock));
    setCategory(product.category || "Stationery");
    setDescription(product.description || "");
    setImageUrl(product.image_url || "");
    setSku(product.sku || "");
    setMinimumOrder(String(product.min_order_quantity || 1));
    setIsActive(product.is_active);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setPrice("");
    setRetailPrice("");
    setWholesalePrice("");
    setStock("");
    setCategory("Stationery");
    setDescription("");
    setImageUrl("");
    setSku("");
    setMinimumOrder("1");
    setIsActive(true);
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-[#f4f2e9] p-6 text-[#172b24]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-[#174333] hover:underline"
          >
            ← Dashboard
          </Link>

          <h1 className="mt-4 font-serif text-3xl font-semibold text-[#172b24]">
            Product catalogue
          </h1>
          <p className="mt-2 text-sm text-[#68776d]">
            Manage stationery, retail and wholesale prices, and stock availability.
          </p>
        </header>

        <form
          onSubmit={addProduct}
          className="space-y-4 border-y border-[#d5dfd5] bg-white p-6"
        >
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit product" : "Add a product"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Product name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
                placeholder="e.g. Arabic Reading Book"
              />
            </label>
            <label className="block text-sm">
              Category
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
                placeholder="School supplies"
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm">Price (SAR)</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
              placeholder="Price"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">
                Retail Price (SAR, optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                className="w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
                placeholder="Blank = Price"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">
                Wholesale Price (SAR, optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                className="w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
                placeholder="Blank = Price"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm">Stock Quantity</label>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
              placeholder="e.g. 25"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              SKU (optional)
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
                placeholder="e.g. BK-104"
              />
            </label>
            <label className="block text-sm">
              Minimum order quantity
              <input
                required
                type="number"
                min="1"
                step="1"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
              />
            </label>
          </div>

          <label className="block text-sm">
            Description (optional)
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
            />
          </label>

          <label className="block text-sm">
            Product image URL (optional)
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#d3ddd4] bg-white p-3 outline-none focus:border-[#174333]"
              placeholder="https://..."
            />
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-yellow-400"
            />
            Visible in the public catalogue
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#174333] p-3 font-semibold text-white hover:bg-[#235b46] disabled:opacity-50"
          >
            {loading ? "Saving..." : editingId ? "Save changes" : "Add product"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-md border border-[#d3ddd4] p-3 text-sm hover:bg-[#f5f7f2]"
            >
              Cancel editing
            </button>
          )}

          {message && (
            <p
              role="status"
              className="break-words rounded-md border border-[#d5dfd5] bg-[#f4f7ed] p-3 text-sm text-[#365844]"
            >
              {message}
            </p>
          )}
        </form>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Product List ({products.length})
          </h2>

          {products.map((product) => (
            <article
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dfd5] bg-white p-4"
            >
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-sm text-[#68776d]">
                  {product.category} · {product.sku || "No SKU"} · minimum {product.min_order_quantity}
                </p>
                <p className="text-sm text-[#68776d]">
                  Price: {product.price} SAR
                </p>
                <p className="text-sm text-[#68776d]">
                  Retail: {product.retail_price} SAR
                </p>
                <p className="text-sm text-[#68776d]">
                  Wholesale: {product.wholesale_price} SAR
                </p>
              </div>

              <p className="text-sm text-[#44564a]">
                Stock: {product.stock} · {product.is_active ? "Visible" : "Hidden"}
              </p>
              <button
                type="button"
                onClick={() => startEditing(product)}
                className="rounded-md border border-[#d3ddd4] px-3 py-2 text-sm hover:bg-[#f5f7f2]"
              >
                Edit product
              </button>
            </article>
          ))}

          {products.length === 0 && !message && (
            <p className="text-[#68776d]">No products added yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}