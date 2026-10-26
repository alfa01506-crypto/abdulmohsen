import Link from "next/link";
import ChatBot from "./components/ChatBot";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f4f2e9] text-[#172b24]">
      <header className="absolute inset-x-0 top-0 z-10 border-b border-white/20 text-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <span className="grid size-11 place-items-center rounded-sm border border-white/45 font-serif text-xs font-bold">
              AM
            </span>
            <span>
              <span className="block font-serif text-lg font-semibold leading-tight">
                Abdul Mohsen
              </span>
              <span className="block text-[10px] font-semibold uppercase">
                Stationery Mart · Saudi Arabia
              </span>
            </span>
          </Link>
          <Link
            href="/admin"
            className="text-sm font-medium text-white/85 no-underline hover:text-white"
          >
            Staff login
          </Link>
        </div>
      </header>

      <section className="relative flex min-h-[64vh] items-end overflow-hidden bg-[#18251d] px-4 pb-10 pt-28 text-white sm:min-h-[70vh] sm:px-8 sm:pb-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=2200&q=85')",
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#10271d]/65" />
        <div className="relative mx-auto w-full max-w-7xl">
          <p className="text-xs font-semibold uppercase text-[#d9ef73]">
            Stationery for home, school &amp; business
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">
            The right supplies for every desk.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
            Shop everyday essentials, school supplies, and wholesale stationery from Abdul Mohsen in Saudi Arabia.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/retail"
              className="inline-flex h-12 items-center justify-center rounded-sm bg-[#d9ef73] px-5 text-sm font-semibold text-[#172b24] no-underline transition hover:bg-[#e4f69b]"
            >
              Shop retail <span aria-hidden="true" className="ml-3">→</span>
            </Link>
            <Link
              href="/wholesale"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-white/60 px-5 text-sm font-semibold text-white no-underline transition hover:bg-white/10"
            >
                Shop wholesale <span aria-hidden="true" className="ml-3">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase text-[#64702f]">Choose your store</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">One stationery catalogue. Two ways to shop.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#637167]">
            Choose retail for individual purchases or wholesale pricing for your shop and business.
          </p>
        </div>

        <div className="mt-7 grid border-y border-[#d5dfd5] md:grid-cols-2">
          <article className="flex min-h-48 flex-col items-start justify-between border-b border-[#d5dfd5] py-6 md:border-b-0 md:border-r md:pr-8">
            <div>
              <p className="text-xs font-semibold uppercase text-[#54725d]">For shops &amp; resellers</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold">Wholesale</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#637167]">
                Bulk stationery, business pricing, and minimum order quantities.
              </p>
            </div>
            <Link href="/wholesale" className="mt-5 text-sm font-semibold text-[#174333] no-underline hover:underline">
              Explore wholesale <span aria-hidden="true">→</span>
            </Link>
          </article>

          <article className="flex min-h-48 flex-col items-start justify-between py-6 md:pl-8">
            <div>
              <p className="text-xs font-semibold uppercase text-[#64702f]">For individual shoppers</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold">Retail</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#637167]">
                Shop stationery by the piece with delivery or pickup options.
              </p>
            </div>
            <Link href="/retail" className="mt-5 text-sm font-semibold text-[#174333] no-underline hover:underline">
              Browse the catalogue <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
      <footer className="border-t border-[#d5dfd5] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 pr-16 text-sm sm:px-8 sm:pr-24">
          <p className="text-[#68776d]">Abdul Mohsen Stationery Mart · Saudi Arabia</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/track-order" className="font-semibold text-[#174333] no-underline hover:underline">
              Track an order <span aria-hidden="true">→</span>
            </Link>
            <a
              href="https://wa.me/966591767600?text=Hello%2C%20I%20have%20a%20question%20about%20your%20stationery%20products."
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#174333] no-underline hover:underline"
            >
              Questions? Chat with us on WhatsApp <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </footer>
      <ChatBot />
    </main>
  );
}