import { redirect } from "next/navigation";
import { StudioShell } from "@/components/layout/StudioShell";
import { getCurrentUser } from "@/lib/security/permissions";

export default async function StudioLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <StudioShell user={user}>{children}</StudioShell>;
}
