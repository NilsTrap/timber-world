import * as React from "react";

import { cn } from "../utils";

/**
 * "Google-Sheets-style dense" table recipe — matches the Orders tables.
 *
 * Shrinks font to 12px and tightens padding/row height so far more data fits
 * per screen. Uses descendant-combinator arbitrary variants ([&_td]/[&_th]),
 * which have higher CSS specificity than per-cell `text-sm`/`px-2`, so it
 * overrides existing cell classes without editing every cell.
 *
 * - On the <Table> primitive: pass the `dense` prop.
 * - On a raw <table> element: spread this string into its className.
 */
export const DENSE_TABLE_CLASS =
  "text-xs [&_th]:h-8 [&_th]:px-1 [&_th]:py-0 [&_th]:text-xs [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-xs";

const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentProps<"table"> & { dense?: boolean }
>(({ className, dense, ...props }, ref) => {
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        ref={ref}
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          dense && DENSE_TABLE_CLASS,
          className
        )}
        {...props}
      />
    </div>
  );
});
Table.displayName = "Table";

function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-10 px-2 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
