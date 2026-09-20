import { getAppData, getCurrentUserAction } from '@/lib/actions';
import { MainApp } from '@/components/MainApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [initialData, currentUser] = await Promise.all([
    getAppData(),
    getCurrentUserAction(),
  ]);

  return <MainApp initialData={initialData} initialUser={currentUser} />;
}
