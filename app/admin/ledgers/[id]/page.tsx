import { LedgerDetailPage } from '@/src/components/LedgerDetailPage';

export default async function AdminLedgerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LedgerDetailPage ledgerId={id} />;
}
