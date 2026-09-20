import { getAppData } from '@/lib/actions';
import { getCurrentUser } from '@/lib/auth';
import { MainApp } from '@/components/MainApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [initialData, currentUser] = await Promise.all([getAppData(), getCurrentUser()]);

  return <MainApp initialData={initialData} initialCurrentUser={currentUser} />;
}
