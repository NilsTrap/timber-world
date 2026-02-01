import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import { ViewAsBannerWrapper } from "@/features/view-as/components";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <SidebarWrapper />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ViewAsBannerWrapper />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
