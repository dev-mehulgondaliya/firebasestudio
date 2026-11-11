import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add Firebase project · Firebase Studio" };

export default function NewConnectionPage() {
  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Add Firebase project"
        description="Connect with a Web config (browser, Security Rules enforced) or an Admin service account (server, full access)."
      />
      <ConnectionForm />
    </div>
  );
}
