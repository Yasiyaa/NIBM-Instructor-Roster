import { getAppData } from '@/lib/actions';
import { MainApp } from '@/components/MainApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialData = await getAppData();

  return <MainApp initialData={initialData} />;
}
