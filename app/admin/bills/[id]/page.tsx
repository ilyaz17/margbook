import { BillDetailPage } from '@/src/components/BillDetailPage';

export default async function AdminBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillDetailPage invoiceId={id} />;
}
