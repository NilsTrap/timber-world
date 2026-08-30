import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import { ViewAsBannerWrapper } from "@/features/view-as/components";
import { SessionVerificationGuard } from "@/components/SessionVerificationGuard";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionVerificationGuard>
      <div className="fixed inset-0 flex min-h-0 bg-background">
        <SidebarWrapper />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ViewAsBannerWrapper />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
    </SessionVerificationGuard>
  );
}
