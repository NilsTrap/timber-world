import { Loader2 } from "lucide-react";

export default function PartiesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Parties</h1>
        <p className="text-muted-foreground">Loading parties...</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
