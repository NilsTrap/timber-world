import { Skeleton } from "@timber/ui";

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
