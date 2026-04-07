import { Skeleton } from "@timber/ui";

export default function ShipmentsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
