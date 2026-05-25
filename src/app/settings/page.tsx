import { getTagSettings } from '@/lib/db/queries';
import { SettingsView } from '@/components/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const initial = await getTagSettings();
  return <SettingsView initial={initial} />;
}
