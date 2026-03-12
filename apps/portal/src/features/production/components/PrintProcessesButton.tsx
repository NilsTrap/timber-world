"use client";

import { useState, useRef } from "react";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { printHtml, PRINT_STYLES_PORTRAIT } from "@/lib/print";
import type { ProcessWithNotes } from "../types";

interface PrintProcessesButtonProps {
  processes: ProcessWithNotes[];
  organizationName?: string;
}

export function PrintProcessesButton({
  processes,
  organizationName,
}: PrintProcessesButtonProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!contentRef.current) return;
    printHtml(contentRef.current.innerHTML, PRINT_STYLES_PORTRAIT);
  };

  if (processes.length === 0) {
    return null;
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Print Production Processes</DialogTitle>
          </DialogHeader>

          <div ref={contentRef} className="overflow-x-auto">
            <div className="header mb-6">
              <h1 className="text-xl font-bold">Production Processes</h1>
              {organizationName && (
                <p className="text-sm text-gray-600">Organization: {organizationName}</p>
              )}
              <p className="text-sm text-gray-600">
                Total processes: {processes.length}
              </p>
            </div>

            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2 px-2 font-semibold w-20">Code</th>
                  <th className="text-left py-2 px-2 font-semibold w-40">Process Name</th>
                  <th className="text-left py-2 px-2 font-semibold">Description / Notes</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.id} className="border-b border-gray-300">
                    <td className="py-2 px-2 font-mono font-medium align-top">
                      {process.code}
                    </td>
                    <td className="py-2 px-2 align-top">{process.value}</td>
                    <td className="py-2 px-2 whitespace-pre-wrap">
                      {process.notes || <span className="text-gray-400 italic">No description</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-xs text-gray-500">
              Printed: {new Date().toLocaleString("en-GB")}
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
