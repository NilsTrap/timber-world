"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import type { ProcessWithNotes } from "../types";

interface PrintProcessesButtonProps {
  processes: ProcessWithNotes[];
  organizationName?: string;
}

/**
 * Print Processes Button
 *
 * Opens a print-friendly dialog with production processes and their descriptions.
 * Users can print or save as PDF using the browser's print dialog.
 */
export function PrintProcessesButton({
  processes,
  organizationName,
}: PrintProcessesButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (processes.length === 0) {
    return null;
  }

  const tableContent = (
    <>
      {/* Header for print */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">Production Processes</h1>
        {organizationName && (
          <p className="text-sm text-gray-600">Organization: {organizationName}</p>
        )}
        <p className="text-sm text-gray-600">
          Total processes: {processes.length}
        </p>
      </div>

      {/* Table */}
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

      {/* Print timestamp */}
      <p className="mt-4 text-xs text-gray-500">
        Printed: {new Date().toLocaleString("en-GB")}
      </p>
    </>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>

      {/* Print-only content - portaled to body, hidden on screen, shown when printing */}
      {mounted && open && createPortal(
        <div
          id="print-area"
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "white",
            padding: "20px",
            zIndex: 99999,
          }}
        >
          {tableContent}
        </div>,
        document.body
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[950px] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Print Production Processes</DialogTitle>
          </DialogHeader>

          {/* Screen preview content */}
          <div className="overflow-x-auto">
            {tableContent}
          </div>

          {/* Print button */}
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

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: portrait;
            margin: 15mm;
          }
          body > *:not(#print-area) {
            display: none !important;
          }
          #print-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            padding: 0 !important;
          }
          #print-area table {
            width: 100% !important;
            font-size: 11pt !important;
          }
          #print-area th,
          #print-area td {
            padding: 8px 6px !important;
          }
        }
      `}</style>
    </>
  );
}
