This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Wholesale Store Setup

The public catalogue and guest order requests require five Supabase migrations, in filename order: `supabase/migrations/20261026000000_wholesale_orders.sql`, `supabase/migrations/20261027000000_order_fulfillment.sql`, `supabase/migrations/20261027000002_moyasar_payments.sql`, `supabase/migrations/20261027000003_store_channels.sql`, then `supabase/migrations/20261027000004_order_compatibility.sql`. Run them in the Supabase SQL Editor before using the storefront. They add catalogue fields and access policies, secure order/payment functions, admin status updates, stock reservation/restoration, home-delivery/store-pickup selection, and server-validated channel-specific pricing. The later migrations also make pickup address fields optional, normalize placeholder categories, and remove an older payment-method constraint that can reject checkout.

The migrations expect the existing `products`, `orders`, and `admin_users` tables used by the admin pages. Product images can be set with a public image URL in product management. The root page links to `/wholesale` and `/retail`; checkout can create an order request and optionally use Moyasar when its keys are configured. Staff confirm fulfilment. No refund workflow is configured.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `OPENAI_API_KEY` in `.env.local`. To enable Moyasar card payments, also set `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Use Moyasar test keys first; never expose secret keys with a `NEXT_PUBLIC_` prefix. OpenAI credits are required for AI product search and chat; the catalogue, basket, and order request are separate from the AI chat.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
