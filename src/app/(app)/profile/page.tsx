import { ProfileWorkspace } from "@/components/profile/profile-workspace";
import { getProfileSnapshot } from "@/lib/profile/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profileSnapshot = await getProfileSnapshot();

  return <ProfileWorkspace profileSnapshot={profileSnapshot} />;
}
