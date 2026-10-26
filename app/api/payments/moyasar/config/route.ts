export async function GET() {
  const enabled = Boolean(
    process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY &&
      process.env.MOYASAR_SECRET_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return Response.json({ enabled });
}