import { getAppData } from '@/lib/actions';
import { getCurrentUser } from '@/lib/auth';
import { MainApp } from '@/components/MainApp';

export const dynamic = 'force-dynamic';

async function loadHomeData() {
  try {
    return await Promise.all([getAppData(), getCurrentUser()]);
  } catch (err) {
    console.warn('[HomePage] Transient DB connection hiccup on initial load, retrying once...', err);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await Promise.all([getAppData(), getCurrentUser()]);
  }
}

export default async function HomePage() {
  const [initialData, currentUser] = await loadHomeData();
  return <MainApp initialData={initialData} initialCurrentUser={currentUser} />;
}
