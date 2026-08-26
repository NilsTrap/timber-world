import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildNeutralCleanFileName, cleanDxfText, cleanHtmlText, cleanPdfBytes, inferSensitiveFileNameTerms, normaliseSensitiveTerms } from "../fileCleanup";

const terms = normaliseSensitiveTerms(["Buyer Ltd", "Jane Doe", "jane@buyer.test", "+371 20000000", "Project Oak", "Buyer Ltd"]);
assert.deepEqual(terms, ["jane@buyer.test", "+371 20000000", "project oak", "buyer ltd", "jane doe"]);

const html = cleanHtmlText('<html><head><style>@/**/import "https://attacker.test/tracker.css";@import"https://attacker.test/no-space.css";@\\69mport "https://attacker.test/escaped.css";.report{display:grid;color:green;background:url(data:image/png;base64,AA==)}.buyer-ltd{font-weight:bold}.BuyerLtd{color:red}.leak{background:u\\72l(https://attacker.test/pixel)}.src{background:src("https://attacker.test/src")}.set{background:image-set("https://attacker.test/two.png" 2x)}.break{content:"\\3C /style>\\3C script>alert(1)\\3C /script>"}.invalid{content:"\\110000"}</style><script>alert(1)</script><meta name="owner" content="Buyer Ltd"><base href="https://attacker.test"></head><body/onload=steal()><form action=javascript:steal()><h1 class="report buyer\\2d ltd" style="background:u\\72l(https://attacker.test/inline)">Buyer Ltd</h1><img src="https://attacker.test/pixel.png" srcset="https://attacker.test/2x.png 2x"><video poster="https://attacker.test/poster"></video><table background="https://attacker.test/background"></table><p>jane&#64;buyer.test</p><a href="java&#x73;cript:steal()">unsafe</a><svg><a xlink:href="javascript:steal()">svg</a></svg><iframe srcdoc="unsafe"></iframe></form></body></html>', terms);
assert(!html.output.includes("Buyer Ltd"));
assert(!html.output.includes("jane@buyer.test"));
assert(!html.output.includes("<script"));
assert(!html.output.includes("<iframe"));
assert(!html.output.includes("<form"));
assert(!html.output.includes("onload="));
assert(!html.output.includes("javascript:"));
assert(!html.output.includes("<base"));
assert(!html.output.includes("<svg"));
assert(html.output.includes("<style>"));
assert(html.output.includes("display:grid"));
assert(html.output.includes("data:image/png"));
assert(!html.output.includes("attacker.test"));
assert(!html.output.includes("buyer-ltd"));
assert.equal((html.output.match(/<script/giu) ?? []).length, 0);
assert(!html.output.includes("</style><script"));
assert(html.output.includes("removed-identifier"));
assert.equal(html.findings.length, 2);

const cleanName = buildNeutralCleanFileName("html", "a1b2c3d4");
assert.equal(cleanName, "Cleaned report a1b2c3d4.html");
assert(!cleanName.includes("Jane Masen"));
assert.deepEqual(inferSensitiveFileNameTerms("S04739 - Jane Masen - Metal_ v10_Report.html"), ["Jane Masen"]);

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
