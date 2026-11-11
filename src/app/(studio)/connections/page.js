import { Suspense } from "react";
import { ConnectionsView } from "@/components/connections/ConnectionsView";

export const metadata = { title: "Connections · Firebase Studio" };

export default function ConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsView />
    </Suspense>
  );
}
