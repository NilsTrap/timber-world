import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { cleanDxfText, cleanHtmlText, cleanPdfBytes, normaliseSensitiveTerms } from "../fileCleanup";

const terms = normaliseSensitiveTerms(["Buyer Ltd", "Jane Doe", "jane@buyer.test", "+371 20000000", "Project Oak", "Buyer Ltd"]);
assert.deepEqual(terms, ["jane@buyer.test", "+371 20000000", "project oak", "buyer ltd", "jane doe"]);

const html = cleanHtmlText('<html><head><script>alert(1)</script><meta name="owner" content="Buyer Ltd"><base href="https://attacker.test"></head><body/onload=steal()><form action=javascript:steal()><h1>Buyer Ltd</h1><p>jane&#64;buyer.test</p><a href="java&#x73;cript:steal()">unsafe</a><svg><a xlink:href="javascript:steal()">svg</a></svg><iframe srcdoc="unsafe"></iframe></form></body></html>', terms);
assert(!html.output.includes("Buyer Ltd"));
assert(!html.output.includes("jane@buyer.test"));
assert(!html.output.includes("<script"));
assert(!html.output.includes("<iframe"));
assert(!html.output.includes("<form"));
assert(!html.output.includes("onload="));
assert(!html.output.includes("javascript:"));
assert(!html.output.includes("<base"));
assert(!html.output.includes("<svg"));
assert.equal(html.findings.length, 2);

const dxf = cleanDxfText("0\nSECTION\n2\nENTITIES\n0\nTEXT\n1\nBuyer Ltd\n0\nMTEXT\n1\nProject Oak\n0\nENDSEC\n0\nEOF", terms);
assert(dxf.output.includes("[REMOVED]"));
assert(!dxf.output.toLowerCase().includes("buyer ltd"));
assert.equal(dxf.findings.length, 2);

async function testPdfCleanup() {
  const sourcePdf = await PDFDocument.create();
  sourcePdf.setAuthor("Jane Doe");
  sourcePdf.setTitle("Project Oak");
  const page = sourcePdf.addPage([600, 800]);
  const font = await sourcePdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Buyer Ltd", { x: 80, y: 650, size: 16, font });
  const cleanedPdf = await cleanPdfBytes((await sourcePdf.save()).buffer as ArrayBuffer, terms);
  const reopened = await PDFDocument.load(cleanedPdf.output);
  assert.equal(reopened.getAuthor(), "");
  assert.equal(reopened.getTitle(), "");
  assert(cleanedPdf.findings.some((finding) => finding.type === "matched_term" && finding.label === "buyer ltd"));
  assert(cleanedPdf.findings.some((finding) => finding.type === "metadata"));
}

testPdfCleanup().then(() => console.log("fileCleanup.test.ts: all assertions passed"));
