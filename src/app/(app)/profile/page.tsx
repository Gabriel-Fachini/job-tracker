import { ProfileWorkspace } from "@/components/profile/profile-workspace";
import { getProfileSnapshot } from "@/lib/profile/queries";
import { getSearchPreferences } from "@/lib/search-preferences-queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profileSnapshot = await getProfileSnapshot();

  const searchPreferences = getSearchPreferences();

  return (
    <ProfileWorkspace
      profileSnapshot={profileSnapshot}
      searchPreferences={searchPreferences}
    />
  );
}
