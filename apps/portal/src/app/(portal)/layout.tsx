import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import { ViewAsBannerWrapper } from "@/features/view-as/components";
import { SessionVerificationGuard } from "@/components/SessionVerificationGuard";
import { PerfDebugger } from "@/components/debug/PerfDebugger";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionVerificationGuard>
      {/* Temporary perf instrumentation — logs Web Vitals + resource
          breakdown to the browser console 2.5s after each page load.
          Remove after we're done diagnosing sluggishness. */}
      <PerfDebugger />
      <div className="flex h-screen bg-background">
        <SidebarWrapper />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ViewAsBannerWrapper />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
    </SessionVerificationGuard>
  );
}
