"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import ChatBot from "./ChatBot";

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
};

type StorefrontMode = "wholesale" | "retail";

type CartLine = { productId: string; quantity: number };
type CartEvent = CustomEvent<{ productId: string; quantity?: number }>;
type PendingPayment = { orderId: string; total: number };

type MoyasarForm = {
  init: (options: {
    element: string;
    amount: number;
    currency: "SAR";
    description: string;
    publishable_api_key: string;
    callback_url: string;
    methods: string[];
    metadata: { order_id: string };
  }) => void;
};

declare global {
  interface Window {
    Moyasar?: MoyasarForm;
  }
}

const CART_STORAGE_KEY = "abdul-mohsen-store-cart";
const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value);

function productPrice(product: Product, mode: StorefrontMode) {
  return mode === "retail" ? product.retail_price : product.wholesale_price;
}

function minimumQuantity(product: Product, mode: StorefrontMode) {
  return mode === "retail" ? 1 : product.min_order_quantity;
}

export default function Storefront({ mode }: { mode: StorefrontMode }) {
  const cartStorageKey = `${CART_STORAGE_KEY}-${mode}`;
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState("All products");
  const [notice, setNotice] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderComplete, setOrderComplete] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pay_later" | "moyasar">("pay_later");
  const [moyasarEnabled, setMoyasarEnabled] = useState(false);
  const [moyasarReady, setMoyasarReady] = useState(false);
  const [moyasarLoadError, setMoyasarLoadError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentReturnOrderId, setPaymentReturnOrderId] = useState("");
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    company: "",
    email: "",
    address: "",
    notes: "",
  });
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "home_delivery" | "store_pickup"
  >("home_delivery");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, retail_price, wholesale_price, stock, category, description, image_url, sku, min_order_quantity"
        )
        .eq("is_active", true)
        .order("name");

      if (!active) return;

      if (error) {
        setNotice("Products could not be loaded. Please try again shortly.");
      } else {
        setProducts((data ?? []) as Product[]);
      }

      setLoading(false);
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/payments/moyasar/config")
      .then((response) => response.json())
      .then((result: { enabled?: boolean }) => {
        if (active) setMoyasarEnabled(result.enabled === true);
      })
      .catch(() => {
        if (active) setMoyasarEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingPayment || !moyasarReady || !window.Moyasar) return;

    const form = document.querySelector("#moyasar-payment-form");
    const publishableKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
    if (!(form instanceof HTMLElement) || !publishableKey) return;

    form.replaceChildren();
    try {
      window.Moyasar.init({
        element: "#moyasar-payment-form",
        amount: Math.round(pendingPayment.total * 100),
        currency: "SAR",
        description: `${mode === "retail" ? "Retail" : "Wholesale"} order ${pendingPayment.orderId}`,
        publishable_api_key: publishableKey,
        callback_url: `${window.location.origin}/${mode}?moyasar_return=1&order_id=${encodeURIComponent(pendingPayment.orderId)}`,
        methods: ["creditcard"],
        metadata: { order_id: pendingPayment.orderId },
      });
    } catch (error) {
      console.error("Moyasar form initialization failed:", error);
      queueMicrotask(() =>
        setPaymentNotice("Online payment could not be opened. Your order is still awaiting payment.")
      );
    }
  }, [mode, moyasarReady, pendingPayment]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("moyasar_return") !== "1") return;

    const orderId = params.get("order_id") || "";
    const paymentId = params.get("id") || "";

    async function verifyPayment() {
      try {
        const response = await fetch("/api/payments/moyasar/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, paymentId }),
        });
        const result = (await response.json()) as {
          paid?: boolean;
          error?: string;
        };

        if (!response.ok || !result.paid) {
          setPaymentNotice(
            result.error || "Payment was not completed. The order is still awaiting payment."
          );
          return;
        }

        setOrderComplete(orderId);
  setPaymentVerified(true);
        setPaymentNotice("");
        setCart([]);
      } catch {
        setPaymentNotice("We couldn't verify the payment yet. Please contact the store before retrying.");
      }
    }

    queueMicrotask(() => {
      setCartOpen(true);
      setOrderComplete("");
      setPaymentReturnOrderId(orderId);
      setPendingPayment(null);
      setPaymentNotice("Verifying your payment...");
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
      void verifyPayment();
    });
  }, []);

  useEffect(() => {
    if (!pendingPayment) return;
    const form = document.querySelector("#moyasar-payment-form");
    if (!form) return;
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pendingPayment]);

  useEffect(() => {
    let restoredCart: CartLine[] = [];
    try {
      const savedCart = localStorage.getItem(cartStorageKey);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartLine[];
        if (Array.isArray(parsed)) {
          restoredCart = parsed.filter(
            (line) =>
              typeof line.productId === "string" &&
              Number.isInteger(line.quantity) &&
              line.quantity > 0
          );
        }
      }
    } catch {
      localStorage.removeItem(cartStorageKey);
    }
    queueMicrotask(() => {
      setCart(restoredCart);
      setCartReady(true);
    });
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartReady) return;
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartReady, cartStorageKey]);

  const addProductToCart = useCallback((product: Product, amount = minimumQuantity(product, mode)) => {
    const currentQuantity =
      cart.find((line) => line.productId === product.id)?.quantity ?? 0;
    const quantityToAdd = Math.max(
      minimumQuantity(product, mode),
      Math.floor(amount)
    );

    if (currentQuantity + quantityToAdd > product.stock) {
      setNotice(`Only ${product.stock} units of ${product.name} are currently available.`);
      setCartOpen(true);
      return false;
    }

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      return existing
        ? current.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + quantityToAdd }
              : line
          )
        : [...current, { productId: product.id, quantity: quantityToAdd }];
    });
    setNotice(`${product.name} added to your basket.`);
    setOrderComplete("");
    return true;
  }, [cart, mode]);

  useEffect(() => {
    function handleBotAdd(event: Event) {
      const { productId, quantity } = (event as CartEvent).detail;
      const product = products.find((item) => item.id === productId);
      if (!product) {
        setNotice("That product is no longer available in the catalogue.");
        return;
      }
      if (addProductToCart(product, quantity ?? minimumQuantity(product, mode))) {
        setCartOpen(true);
      }
    }

    function handleBotOpenCart() {
      setCartOpen(true);
    }

    window.addEventListener("store:add-to-cart", handleBotAdd);
    window.addEventListener("store:open-cart", handleBotOpenCart);
    return () => {
      window.removeEventListener("store:add-to-cart", handleBotAdd);
      window.removeEventListener("store:open-cart", handleBotOpenCart);
    };
  }, [addProductToCart, mode, products]);

  const categories = [
    "All products",
    ...new Set(products.map((product) => product.category || "General")),
  ];
  const visibleProducts = products.filter((product) => {
    const matchesCategory =
      category === "All products" || product.category === category;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      product.name.toLowerCase().includes(query) ||
      (product.description ?? "").toLowerCase().includes(query) ||
      (product.sku ?? "").toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  const cartRows = cart
    .map((line) => ({
      line,
      product: products.find((product) => product.id === line.productId),
    }))
    .filter(
      (row): row is { line: CartLine; product: Product } =>
        row.product !== undefined
    );
  const itemCount = cartRows.reduce((sum, row) => sum + row.line.quantity, 0);
  const subtotal = cartRows.reduce(
    (sum, row) => sum + productPrice(row.product, mode) * row.line.quantity,
    0
  );

  function changeQuantity(product: Product, nextQuantity: number) {
    if (nextQuantity < minimumQuantity(product, mode)) {
      setCart((current) =>
        current.filter((line) => line.productId !== product.id)
      );
      return;
    }
    if (nextQuantity > product.stock) {
      setNotice(`Only ${product.stock} units of ${product.name} are available.`);
      return;
    }
    setCart((current) =>
      current.map((line) =>
        line.productId === product.id
          ? { ...line, quantity: nextQuantity }
          : line
      )
    );
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cartRows.length === 0 || orderBusy) return;
    if (paymentMethod === "moyasar" && !moyasarEnabled) {
      setNotice("Online payment is not configured yet. Choose pay on confirmation instead.");
      return;
    }
    if (paymentMethod === "moyasar" && subtotal < 1) {
      setNotice("Moyasar card payments require an order of at least SAR 1.");
      return;
    }

    setOrderBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer.name,
          phone: customer.phone,
          salesChannel: mode,
          fulfillmentMethod,
          paymentMethod,
          company: customer.company,
          email: customer.email,
          address: customer.address,
          notes: customer.notes,
          items: cartRows.map(({ line }) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });
      const result = (await response.json()) as {
        orderId?: string;
        total?: number;
        error?: string;
      };

      if (!response.ok || !result.orderId) {
        throw new Error(result.error || "We couldn't submit your order request.");
      }

      setNotice("");
      setPaymentNotice("");
      if (paymentMethod === "moyasar") {
        if (!result.total || result.total <= 0) {
          throw new Error("The order total could not be verified. Please contact the store.");
        }
        setPaymentReturnOrderId("");
        setPaymentVerified(false);
        setPendingPayment({ orderId: result.orderId, total: result.total });
        setCart([]);
      } else {
        setPaymentReturnOrderId("");
        setPaymentVerified(false);
        setOrderComplete(result.orderId);
        setCart([]);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We couldn't submit your order request. Please try again."
      );
    } finally {
      setOrderBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#172b24]">
      {moyasarEnabled && (
        <>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.css"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.0/dist/moyasar.umd.min.js"
            strategy="afterInteractive"
            onReady={() => setMoyasarReady(true)}
            onError={() => setMoyasarLoadError("The secure payment form could not be loaded. Please try again later.")}
          />
        </>
      )}
      <header className="border-b border-[#dfe6dd] bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 no-underline">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#174333] font-serif text-xs font-bold text-white">
              AM
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-semibold leading-tight text-[#172b24]">
                Abdul Mohsen
              </span>
              <span className="block text-[10px] font-semibold uppercase text-[#68776d]">
                {mode === "retail" ? "Retail Stationery Mart" : "Wholesale Stationery Mart"}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-5">
            <Link
              href={mode === "retail" ? "/wholesale" : "/retail"}
              className="hidden text-sm font-medium text-[#44564a] no-underline hover:text-[#174333] sm:block"
            >
              {mode === "retail" ? "Wholesale" : "Retail"}
            </Link>
            <a
              href="#catalogue"
              className="hidden text-sm font-medium text-[#44564a] no-underline hover:text-[#174333] sm:block"
            >
              Catalogue
            </a>
            <a
              href="/admin"
              className="hidden text-sm font-medium text-[#44564a] no-underline hover:text-[#174333] sm:block"
            >
              Admin
            </a>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#174333] px-3 text-sm font-semibold text-white transition hover:bg-[#235b46] sm:px-4"
              aria-label={`Open basket, ${itemCount} items`}
            >
              <span>Basket</span>
              <span className="grid min-w-5 place-items-center rounded-full bg-[#d9ef73] px-1.5 py-0.5 text-xs font-bold text-[#172b24]">
                {itemCount}
              </span>
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-5 pt-8 sm:px-8 sm:pt-11">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase text-[#54725d]">
              {mode === "retail" ? "Supplies for every day" : "For Saudi shops & resellers"}
            </p>
            <h1 className="mt-2 max-w-2xl font-serif text-3xl font-semibold leading-tight text-[#172b24] sm:text-4xl">
              {mode === "retail"
                ? "Everything for your desk."
                : "Wholesale stationery, made simple."}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#637167]">
              {mode === "retail"
                ? "Browse stationery at retail prices. Buy single items and choose delivery or pickup."
                : "Browse stationery at wholesale prices, with business quantities and order confirmation."}
            </p>
          </div>
          <p className="border-l-2 border-[#d1e66a] py-1 pl-3 text-xs leading-5 text-[#56675a]">
            {mode === "retail" ? "Retail price per item" : "Wholesale price per item"}
            <br />
            Orders confirmed by our team
          </p>
        </div>
      </section>

      <section id="catalogue" className="mx-auto max-w-7xl px-4 pb-16 sm:px-8">
        <div className="flex flex-col gap-3 border-y border-[#dfe6dd] py-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search catalogue</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search stationery, brands or SKU"
              className="h-11 w-full rounded-md border border-[#d3ddd4] bg-white px-3 text-sm outline-none placeholder:text-[#89958b] focus:border-[#174333] focus:ring-2 focus:ring-[#174333]/10"
            />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-md border border-[#d3ddd4] bg-white px-3 text-sm">
            <span className="text-[#68776d]">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="max-w-[175px] bg-transparent font-medium text-[#172b24] outline-none"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-[#68776d] sm:min-w-24 sm:text-right">
            {loading ? "Loading catalogue" : `${visibleProducts.length} products`}
          </p>
        </div>

        {notice && !cartOpen && (
          <p role="status" className="mt-4 border-l-2 border-[#d1a24b] bg-white px-4 py-3 text-sm text-[#47554b]">
            {notice}
          </p>
        )}

        {loading ? (
          <div className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-72 animate-pulse bg-[#e8eee6]" />
            ))}
          </div>
        ) : notice && products.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="font-serif text-2xl font-semibold">Catalogue unavailable</h2>
            <p className="mt-2 text-sm text-[#68776d]">Please try again shortly.</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="font-serif text-2xl font-semibold">No products found</h2>
            <p className="mt-2 text-sm text-[#68776d]">Try another search or category.</p>
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-7 py-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => (
              <article key={product.id} className="min-w-0 border-b border-[#dfe6dd] pb-5">
                {product.image_url ? (
                  <div className="relative mb-4 aspect-[16/10] overflow-hidden bg-[#e8eee6]">
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="mb-4 flex aspect-[16/10] items-end justify-between bg-[#e8eee6] p-4">
                    <span className="font-serif text-4xl font-semibold text-[#174333]/25">
                      {product.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[#68776d]">
                      {product.category || "Stationery"}
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-[#67806b]">
                      {product.category || "General"}
                      {product.sku ? ` · ${product.sku}` : ""}
                    </p>
                    <h2 className="mt-1 font-serif text-xl font-semibold leading-snug text-[#172b24]">
                      <button
                        type="button"
                        onClick={() => setDetailProduct(product)}
                        className="text-left hover:text-[#174333] focus-visible:outline-2 focus-visible:outline-[#174333]"
                      >
                        {product.name}
                      </button>
                    </h2>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold text-[#174333]">
                    {formatPrice(productPrice(product, mode))}
                    <span className="block text-[10px] font-normal text-[#68776d]">per unit</span>
                  </p>
                </div>
                {product.description && (
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#68776d]">
                    {product.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#68776d]">
                    {product.stock > 0
                      ? mode === "retail"
                        ? `${product.stock} available`
                        : `Min. order ${product.min_order_quantity} · ${product.stock} available`
                      : "Currently unavailable"}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      aria-label={`View ${product.name} details`}
                      className="h-9 rounded-md border border-[#d3ddd4] px-3 text-xs font-semibold text-[#44564a] hover:bg-white"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => addProductToCart(product)}
                      disabled={product.stock < minimumQuantity(product, mode)}
                      className="h-9 rounded-md bg-[#174333] px-3 text-xs font-semibold text-white transition hover:bg-[#235b46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174333] disabled:cursor-not-allowed disabled:bg-[#a8b4aa]"
                    >
                      Add to basket
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {detailProduct && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#10271dcc] p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            className="relative max-h-[90dvh] w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
          >
            <button
              type="button"
              onClick={() => setDetailProduct(null)}
              aria-label="Close product details"
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-xl text-[#536258] hover:bg-[#f1f5f0]"
            >
              ×
            </button>
            {detailProduct.image_url && (
              <div className="relative mb-5 aspect-[16/9] overflow-hidden bg-[#e8eee6]">
                <Image
                  src={detailProduct.image_url}
                  alt={detailProduct.name}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            )}
            <p className="text-xs font-semibold uppercase text-[#67806b]">
              {detailProduct.category || "General"}
              {detailProduct.sku ? ` · ${detailProduct.sku}` : ""}
            </p>
            <h2 id="product-detail-title" className="mt-2 pr-10 font-serif text-3xl font-semibold">
              {detailProduct.name}
            </h2>
            {detailProduct.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#637167]">
                {detailProduct.description}
              </p>
            )}
            <div className="mt-5 flex items-end justify-between border-y border-[#dfe6dd] py-4">
              <div>
                <p className="text-xs text-[#68776d]">
                  {mode === "retail" ? "Retail price" : "Wholesale price"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[#174333]">
                  {formatPrice(productPrice(detailProduct, mode))}
                </p>
              </div>
              <p className="text-right text-xs leading-5 text-[#68776d]">
                {mode === "retail"
                  ? `${detailProduct.stock} in stock · single item orders`
                  : `Minimum ${detailProduct.min_order_quantity} · ${detailProduct.stock} in stock`}
              </p>
            </div>
            <button
              type="button"
              disabled={detailProduct.stock < minimumQuantity(detailProduct, mode)}
              onClick={() => {
                addProductToCart(detailProduct);
                setDetailProduct(null);
                setCartOpen(true);
              }}
              className="mt-5 h-11 w-full rounded-md bg-[#174333] px-4 text-sm font-semibold text-white hover:bg-[#235b46] disabled:cursor-not-allowed disabled:bg-[#a8b4aa]"
            >
              Add to basket
            </button>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close basket"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 size-full cursor-default bg-[#10271dcc]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="basket-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[#dfe6dd] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase text-[#67806b]">
                  {mode === "retail" ? "Retail order" : "Wholesale order"}
                </p>
                <h2 id="basket-title" className="mt-1 font-serif text-2xl font-semibold">Your basket</h2>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close basket"
                className="grid size-10 place-items-center rounded-md text-xl text-[#536258] hover:bg-[#f1f5f0]"
              >
                ×
              </button>
            </header>

            {orderComplete ? (
              <div className="flex flex-1 flex-col justify-center px-6 py-10">
                <p className="text-xs font-semibold uppercase text-[#54725d]">
                  {paymentVerified ? "Payment confirmed" : "Request received"}
                </p>
                <h3 className="mt-3 font-serif text-3xl font-semibold">
                  {paymentVerified ? "Thank you for your payment." : "Thank you for your order."}
                </h3>
                <p className="mt-3 leading-6 text-[#637167]">
                  {paymentVerified
                    ? <>Order <strong>#{orderComplete}</strong> is paid. Our team will confirm fulfilment details by phone.</>
                    : <>Your request <strong>#{orderComplete}</strong> has been sent to our team. We’ll confirm availability and next steps by phone.</>}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOrderComplete("");
                    setCartOpen(false);
                  }}
                  className="mt-7 h-11 rounded-md bg-[#174333] px-4 text-sm font-semibold text-white hover:bg-[#235b46]"
                >
                  Continue browsing
                </button>
              </div>
            ) : pendingPayment ? (
              <div className="flex-1 overflow-y-auto px-5 py-6">
                <p className="text-xs font-semibold uppercase text-[#54725d]">Secure payment</p>
                <h3 className="mt-2 font-serif text-2xl font-semibold">Complete your order payment</h3>
                <p className="mt-2 text-sm text-[#637167]">
                  Order #{pendingPayment.orderId} · {formatPrice(pendingPayment.total)}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#68776d]">
                  Card details are entered securely in Moyasar and are never stored by this store.
                </p>
                {(paymentNotice || moyasarLoadError) && (
                  <p role="alert" className="mt-4 border-l-2 border-[#d1a24b] bg-[#fbf8ed] px-3 py-2 text-sm text-[#5b5140]">
                    {paymentNotice || moyasarLoadError}
                  </p>
                )}
                <div id="moyasar-payment-form" className="mt-5 min-h-20" />
              </div>
            ) : paymentReturnOrderId ? (
              <div className="flex flex-1 flex-col justify-center px-6 py-10">
                <p className="text-xs font-semibold uppercase text-[#54725d]">Payment status</p>
                <h3 className="mt-3 font-serif text-2xl font-semibold">Order #{paymentReturnOrderId}</h3>
                <p role="status" className="mt-3 leading-6 text-[#637167]">
                  {paymentNotice || "Checking payment status..."}
                </p>
                <a
                  href="https://wa.me/966591767600"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#174333] px-4 text-sm font-semibold text-white no-underline hover:bg-[#235b46]"
                >
                  Contact the store
                </a>
              </div>
            ) : cartRows.length === 0 ? (
              <div className="flex flex-1 flex-col items-start justify-center px-6">
                <p className="font-serif text-2xl font-semibold">Your basket is empty</p>
                  <p className="mt-2 text-sm text-[#68776d]">Add products from the catalogue to start your order.</p>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="mt-5 h-10 rounded-md bg-[#174333] px-4 text-sm font-semibold text-white hover:bg-[#235b46]"
                >
                  Browse catalogue
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {notice && (
                    <p role="alert" className="mb-4 border-l-2 border-[#d1a24b] bg-[#fbf8ed] px-3 py-2 text-sm text-[#5b5140]">
                      {notice}
                    </p>
                  )}
                  <div className="divide-y divide-[#e3e9e2]">
                    {cartRows.map(({ line, product }) => (
                      <article key={product.id} className="flex items-start justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <h3 className="font-serif text-lg font-semibold">{product.name}</h3>
                          <p className="mt-1 text-xs text-[#68776d]">
                            {formatPrice(productPrice(product, mode))} per unit · {mode === "retail" ? "single item orders" : `minimum ${product.min_order_quantity}`}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[#174333]">
                            {formatPrice(productPrice(product, mode) * line.quantity)}
                          </p>
                        </div>
                        <div className="flex h-9 shrink-0 items-center border border-[#d3ddd4]">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product, line.quantity - 1)}
                            aria-label={`Decrease ${product.name} quantity`}
                            className="size-8 text-lg hover:bg-[#f1f5f0]"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product, line.quantity + 1)}
                            aria-label={`Increase ${product.name} quantity`}
                            className="size-8 text-lg hover:bg-[#f1f5f0]"
                          >
                            +
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-[#dfe6dd] pt-4">
                    <div className="flex justify-between text-sm">
                      <span>Estimated subtotal</span>
                      <strong>{formatPrice(subtotal)}</strong>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#68776d]">
                      Final availability, delivery, and payment details will be confirmed by our team.
                    </p>
                  </div>

                  <form onSubmit={submitOrder} className="mt-6 space-y-3">
                    <div>
                      <h3 className="font-serif text-xl font-semibold">Request this order</h3>
                      <p className="mt-1 text-xs text-[#68776d]">
                        {paymentMethod === "moyasar"
                          ? "Card payment is verified before the order is marked paid."
                          : "No charge now; our team will confirm the order and payment details."}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[#536258]">
                        Contact name *
                        <input
                          required
                          autoComplete="name"
                          value={customer.name}
                          onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                          className="mt-1 h-10 w-full rounded-md border border-[#d3ddd4] px-3 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                        />
                      </label>
                      <label className="text-xs font-medium text-[#536258]">
                        Phone *
                        <input
                          required
                          type="tel"
                          autoComplete="tel"
                          value={customer.phone}
                          onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                          className="mt-1 h-10 w-full rounded-md border border-[#d3ddd4] px-3 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[#536258]">
                        Business name
                        <input
                          value={customer.company}
                          onChange={(event) => setCustomer({ ...customer, company: event.target.value })}
                          className="mt-1 h-10 w-full rounded-md border border-[#d3ddd4] px-3 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                        />
                      </label>
                      <label className="text-xs font-medium text-[#536258]">
                        Email
                        <input
                          type="email"
                          autoComplete="email"
                          value={customer.email}
                          onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                          className="mt-1 h-10 w-full rounded-md border border-[#d3ddd4] px-3 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                        />
                      </label>
                    </div>
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium text-[#536258]">
                        Fulfilment
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["home_delivery", "Home delivery"],
                          ["store_pickup", "Store pickup"],
                        ] as const).map(([value, label]) => (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 text-xs font-medium transition ${
                              fulfillmentMethod === value
                                ? "border-[#174333] bg-[#edf4ed] text-[#174333]"
                                : "border-[#d3ddd4] text-[#536258]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="fulfillment"
                              value={value}
                              checked={fulfillmentMethod === value}
                              onChange={() => setFulfillmentMethod(value)}
                              className="accent-[#174333]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {fulfillmentMethod === "home_delivery" && (
                      <label className="block text-xs font-medium text-[#536258]">
                        Delivery address *
                        <input
                          required
                          autoComplete="street-address"
                          value={customer.address}
                          onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                          className="mt-1 h-10 w-full rounded-md border border-[#d3ddd4] px-3 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                        />
                      </label>
                    )}
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium text-[#536258]">
                        Payment
                      </legend>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[#d3ddd4] px-3 py-3 text-xs text-[#536258]">
                        <input
                          type="radio"
                          name="payment"
                          value="pay_later"
                          checked={paymentMethod === "pay_later"}
                          onChange={() => setPaymentMethod("pay_later")}
                          className="mt-0.5 accent-[#174333]"
                        />
                        <span>
                          <strong className="block text-[#172b24]">Pay on confirmation</strong>
                          Our team will contact you to confirm payment details.
                        </span>
                      </label>
                      <label className={`flex items-start gap-2 rounded-md border px-3 py-3 text-xs ${moyasarEnabled ? "cursor-pointer border-[#d3ddd4] text-[#536258]" : "cursor-not-allowed border-[#e4e8e3] text-[#8d978f]"}`}>
                        <input
                          type="radio"
                          name="payment"
                          value="moyasar"
                          checked={paymentMethod === "moyasar"}
                          onChange={() => setPaymentMethod("moyasar")}
                          disabled={!moyasarEnabled}
                          className="mt-0.5 accent-[#174333]"
                        />
                        <span>
                          <strong className="block text-[#172b24]">Pay online by card</strong>
                          {moyasarEnabled
                            ? "Secure card payment via Moyasar."
                            : "Online payment setup is pending; choose pay on confirmation for now."}
                        </span>
                      </label>
                    </fieldset>
                    {paymentNotice && !pendingPayment && (
                      <p role="alert" className="border-l-2 border-[#d1a24b] bg-[#fbf8ed] px-3 py-2 text-sm text-[#5b5140]">
                        {paymentNotice}
                      </p>
                    )}
                    <label className="block text-xs font-medium text-[#536258]">
                      Order notes
                      <textarea
                        rows={2}
                        value={customer.notes}
                        onChange={(event) => setCustomer({ ...customer, notes: event.target.value })}
                        className="mt-1 w-full resize-y rounded-md border border-[#d3ddd4] px-3 py-2 text-sm text-[#172b24] outline-none focus:border-[#174333]"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={orderBusy}
                      className="h-12 w-full rounded-md bg-[#174333] px-4 text-sm font-semibold text-white transition hover:bg-[#235b46] disabled:cursor-wait disabled:opacity-60"
                    >
                      {orderBusy
                        ? "Submitting order..."
                        : paymentMethod === "moyasar"
                          ? "Continue to secure payment"
                          : "Send order request"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      <footer className="mt-10 border-t border-[#dfe6dd] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 pr-16 text-sm sm:px-8 sm:pr-24">
          <Link href="/" className="text-[#68776d] no-underline hover:text-[#174333]">
            Abdul Mohsen Stationery Mart · Saudi Arabia
          </Link>
          <a
            href={`https://wa.me/966591767600?text=${encodeURIComponent(`Hello, I have a question about ${mode} stationery.`)}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#174333] no-underline hover:underline"
          >
            Chat with us on WhatsApp <span aria-hidden="true">→</span>
          </a>
        </div>
      </footer>
      <ChatBot />
    </main>
  );
}