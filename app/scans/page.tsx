import { Flash } from '@/components/flash';

export const dynamic = 'force-dynamic';

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Scans</h1>
      <Flash done={params.done} error={params.error} />
      <p className="mt-2 max-w-prose text-sm text-zinc-400">
        The scan log — items fetched, Gemini calls, shows found, alerts sent, errors — arrives in
        M6.
      </p>
    </>
  );
}
