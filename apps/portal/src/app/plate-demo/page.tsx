import { PlateEditor } from "@/features/documents/plate/editor/plate-editor";
import { TooltipProvider } from "@/features/documents/plate/ui/tooltip";

// Standalone spike route to verify Plate mounts inside the portal on our stack.
export default function PlateDemoPage() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30 py-10">
        <div className="mx-auto w-[210mm] max-w-full bg-background shadow-sm">
          <PlateEditor />
        </div>
      </div>
    </TooltipProvider>
  );
}
