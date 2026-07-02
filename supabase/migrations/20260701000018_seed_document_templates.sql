-- E6 · Seed one DEFAULT Handlebars template per document type (7 rows).
--
-- Each template is clean, printable, A4-friendly HTML with an inline <style> and
-- Handlebars placeholders bound to DocumentData (see documents/types.ts). Merged
-- server-side by templateMerge.ts (helpers: money, moneyCur, fmtM3, fmtDate, pct)
-- and converted to PDF by the Gotenberg adapter. Layout mirrors the interim jsPDF
-- renderer (specification.ts): seller/buyer party cards, terms line, line-items
-- table, totals + amount-in-words, notes.
--
-- Idempotent: ON CONFLICT on the partial "one default per doc_type" unique index
-- (DO NOTHING) — so a re-run, or a house-authored default already in place, is
-- never clobbered.

INSERT INTO public.document_templates (doc_type, name, html, is_default, is_active) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SALES SPECIFICATION
-- ─────────────────────────────────────────────────────────────────────────────
('sales_spec', 'Sales Specification (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.seller-name { font-size: 16px; font-weight: 700; } .title { font-size: 15px; font-weight: 700; text-align: right; }
.meta { text-align: right; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; }
.party .name { font-weight: 700; } .party div { line-height: 1.4; } .bank { color: #333; }
.refs, .terms { margin: 8px 0; color: #333; } .terms span { margin-right: 14px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; }
.num { text-align: right; }
.totals { margin-top: 12px; width: 280px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
.totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.words { font-style: italic; margin-top: 8px; } .notes { margin-top: 12px; } .notes h4 { margin: 0 0 3px; }
.foot { margin-top: 24px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 12mm; }
</style></head><body>
<div class="head"><div class="seller-name">{{seller.name}}</div><div class="title">{{docTitle}}</div></div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Seller</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.regNo}}<div>Reg. No: {{seller.regNo}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}{{#if seller.email}}<div>{{seller.email}}</div>{{/if}}{{#if seller.phone}}<div>{{seller.phone}}</div>{{/if}}{{#if seller.bankName}}<div class="bank">Bank: {{seller.bankName}}</div>{{/if}}{{#if seller.bankAccount}}<div class="bank">Account: {{seller.bankAccount}}{{#if seller.bankSwift}} &middot; SWIFT: {{seller.bankSwift}}{{/if}}</div>{{/if}}</div>
  <div class="party"><h3>Buyer</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.regNo}}<div>Reg. No: {{buyer.regNo}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}{{#if buyer.email}}<div>{{buyer.email}}</div>{{/if}}{{#if buyer.phone}}<div>{{buyer.phone}}</div>{{/if}}</div>
</div>
{{#if externalRefs.length}}<div class="refs">{{#each externalRefs}}<span><strong>{{label}}:</strong> {{value}}</span>{{/each}}</div>{{/if}}
<div class="terms">{{#if incoterms}}<span>Incoterms: {{incoterms}}</span>{{/if}}{{#if advancePct}}<span>Advance: {{pct advancePct}}</span>{{/if}}{{#if paymentTerms}}<span>Payment: {{paymentTerms}}</span>{{/if}}{{#if deliveryTerms}}<span>Delivery: {{deliveryTerms}}</span>{{/if}}{{#if deliveryDeadline}}<span>Deadline: {{deliveryDeadline}}</span>{{/if}}</div>
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">m&sup3;</th><th class="num">Unit ({{currency}})</th><th class="num">Total ({{currency}})</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td class="num">{{money unitPriceCents}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row"><span>Total volume</span><span>{{fmtM3 totals.totalVolumeM3}} m&sup3;</span></div>
  <div class="row"><span>Subtotal</span><span>{{money totals.subtotalCents}} {{currency}}</span></div>
  <div class="row"><span>VAT ({{totals.vatRate}}%)</span><span>{{money totals.vatCents}} {{currency}}</span></div>
  <div class="row grand"><span>Total</span><span>{{moneyCur totals.totalCents}}</span></div>
</div>
<div class="words">In words: {{totals.amountInWords}}.</div>
{{#if totals.vatReference}}<div class="refs">{{totals.vatReference}}</div>{{/if}}
{{#if notes}}<div class="notes"><h4>Notes</h4><div>{{notes}}</div></div>{{/if}}
<div class="foot">Generated by Timber World &middot; {{docNumber}} &middot; Deal {{dealCode}}</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PURCHASE SPECIFICATION (buyer side = Producer/Supplier)
-- ─────────────────────────────────────────────────────────────────────────────
('purchase_spec', 'Purchase Specification (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.seller-name { font-size: 16px; font-weight: 700; } .title { font-size: 15px; font-weight: 700; text-align: right; }
.meta { text-align: right; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; }
.party .name { font-weight: 700; } .party div { line-height: 1.4; } .bank { color: #333; }
.refs, .terms { margin: 8px 0; color: #333; } .terms span { margin-right: 14px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 12px; width: 280px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
.totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.words { font-style: italic; margin-top: 8px; } .notes { margin-top: 12px; } .notes h4 { margin: 0 0 3px; }
.foot { margin-top: 24px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 12mm; }
</style></head><body>
<div class="head"><div class="seller-name">{{seller.name}}</div><div class="title">{{docTitle}}</div></div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Buyer</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.regNo}}<div>Reg. No: {{seller.regNo}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}{{#if seller.email}}<div>{{seller.email}}</div>{{/if}}{{#if seller.phone}}<div>{{seller.phone}}</div>{{/if}}</div>
  <div class="party"><h3>Producer / Supplier</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.regNo}}<div>Reg. No: {{buyer.regNo}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}{{#if buyer.email}}<div>{{buyer.email}}</div>{{/if}}{{#if buyer.phone}}<div>{{buyer.phone}}</div>{{/if}}{{#if buyer.bankName}}<div class="bank">Bank: {{buyer.bankName}}</div>{{/if}}{{#if buyer.bankAccount}}<div class="bank">Account: {{buyer.bankAccount}}{{#if buyer.bankSwift}} &middot; SWIFT: {{buyer.bankSwift}}{{/if}}</div>{{/if}}</div>
</div>
{{#if externalRefs.length}}<div class="refs">{{#each externalRefs}}<span><strong>{{label}}:</strong> {{value}}</span>{{/each}}</div>{{/if}}
<div class="terms">{{#if incoterms}}<span>Incoterms: {{incoterms}}</span>{{/if}}{{#if advancePct}}<span>Advance: {{pct advancePct}}</span>{{/if}}{{#if paymentTerms}}<span>Payment: {{paymentTerms}}</span>{{/if}}{{#if deliveryTerms}}<span>Delivery: {{deliveryTerms}}</span>{{/if}}{{#if deliveryDeadline}}<span>Deadline: {{deliveryDeadline}}</span>{{/if}}</div>
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">m&sup3;</th><th class="num">Unit ({{currency}})</th><th class="num">Total ({{currency}})</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td class="num">{{money unitPriceCents}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row"><span>Total volume</span><span>{{fmtM3 totals.totalVolumeM3}} m&sup3;</span></div>
  <div class="row"><span>Subtotal</span><span>{{money totals.subtotalCents}} {{currency}}</span></div>
  <div class="row"><span>VAT ({{totals.vatRate}}%)</span><span>{{money totals.vatCents}} {{currency}}</span></div>
  <div class="row grand"><span>Total</span><span>{{moneyCur totals.totalCents}}</span></div>
</div>
<div class="words">In words: {{totals.amountInWords}}.</div>
{{#if notes}}<div class="notes"><h4>Notes</h4><div>{{notes}}</div></div>{{/if}}
<div class="foot">Generated by Timber World &middot; {{docNumber}} &middot; Deal {{dealCode}}</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SALES CONTRACT (clauses body + line-item annex + signatures)
-- ─────────────────────────────────────────────────────────────────────────────
('contract', 'Sales Contract (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; line-height: 1.5; }
.title { font-size: 17px; font-weight: 700; text-align: center; } .meta { text-align: center; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; margin-top: 8px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; } .party .name { font-weight: 700; } .party div { line-height: 1.4; }
h4.clause { margin: 14px 0 3px; font-size: 12px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 10px; width: 280px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; } .totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.sign { display: flex; gap: 48px; margin-top: 48px; } .sign .box { flex: 1; border-top: 1px solid #333; padding-top: 4px; }
.foot { margin-top: 20px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 14mm; }
</style></head><body>
<div class="title">{{docTitle}}</div>
<div class="meta">No. {{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Seller</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.regNo}}<div>Reg. No: {{seller.regNo}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}</div>
  <div class="party"><h3>Buyer</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.regNo}}<div>Reg. No: {{buyer.regNo}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}</div>
</div>
<h4 class="clause">1. Subject of the contract</h4>
<div>The Seller sells and the Buyer buys the timber goods specified in the schedule below, on the terms set out in this contract.</div>
<h4 class="clause">2. Price and total value</h4>
<div>Prices are stated in {{currency}} per the schedule. The total contract value is {{moneyCur totals.totalCents}} including VAT at {{totals.vatRate}}% ({{money totals.vatCents}} {{currency}}). In words: {{totals.amountInWords}}.</div>
<h4 class="clause">3. Payment terms</h4>
<div>{{#if paymentTerms}}{{paymentTerms}}{{else}}As agreed between the parties.{{/if}}{{#if advancePct}} Advance payment: {{pct advancePct}}.{{/if}}</div>
<h4 class="clause">4. Delivery</h4>
<div>{{#if incoterms}}Delivery terms: {{incoterms}}. {{/if}}{{#if deliveryTerms}}{{deliveryTerms}}. {{/if}}{{#if deliveryDeadline}}Delivery deadline: {{deliveryDeadline}}.{{/if}}</div>
<h4 class="clause">5. Schedule of goods</h4>
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">m&sup3;</th><th class="num">Unit ({{currency}})</th><th class="num">Total ({{currency}})</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td class="num">{{money unitPriceCents}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>{{money totals.subtotalCents}} {{currency}}</span></div>
  <div class="row"><span>VAT ({{totals.vatRate}}%)</span><span>{{money totals.vatCents}} {{currency}}</span></div>
  <div class="row grand"><span>Total</span><span>{{moneyCur totals.totalCents}}</span></div>
</div>
{{#if notes}}<h4 class="clause">6. Additional terms</h4><div>{{notes}}</div>{{/if}}
<div class="sign"><div class="box">Seller<br>{{seller.name}}</div><div class="box">Buyer<br>{{buyer.name}}</div></div>
<div class="foot">Generated by Timber World &middot; Contract {{docNumber}} &middot; Deal {{dealCode}}</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PROFORMA / ADVANCE INVOICE (payment emphasis, prominent bank block)
-- ─────────────────────────────────────────────────────────────────────────────
('proforma_invoice', 'Proforma Invoice (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.seller-name { font-size: 16px; font-weight: 700; } .title { font-size: 15px; font-weight: 700; text-align: right; color: #3c525c; }
.meta { text-align: right; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; } .party .name { font-weight: 700; } .party div { line-height: 1.4; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 12px; width: 280px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; } .totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.paybox { margin-top: 14px; border: 1px solid #3c525c; border-radius: 4px; padding: 10px 12px; background: #f4f7f8; }
.paybox h4 { margin: 0 0 4px; color: #3c525c; } .paybox div { line-height: 1.5; }
.words { font-style: italic; margin-top: 8px; }
.foot { margin-top: 20px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 12mm; }
</style></head><body>
<div class="head"><div class="seller-name">{{seller.name}}</div><div class="title">{{docTitle}}</div></div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Supplier</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.regNo}}<div>Reg. No: {{seller.regNo}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}</div>
  <div class="party"><h3>Bill to</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.regNo}}<div>Reg. No: {{buyer.regNo}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}</div>
</div>
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">m&sup3;</th><th class="num">Unit ({{currency}})</th><th class="num">Amount ({{currency}})</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td class="num">{{money unitPriceCents}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>{{money totals.subtotalCents}} {{currency}}</span></div>
  <div class="row"><span>VAT ({{totals.vatRate}}%)</span><span>{{money totals.vatCents}} {{currency}}</span></div>
  <div class="row grand"><span>Total due</span><span>{{moneyCur totals.totalCents}}</span></div>
</div>
<div class="words">In words: {{totals.amountInWords}}.</div>
<div class="paybox"><h4>Payment details</h4>
{{#if advancePct}}<div><strong>Advance requested: {{pct advancePct}}</strong></div>{{/if}}
{{#if paymentTerms}}<div>Terms: {{paymentTerms}}</div>{{/if}}
{{#if seller.bankName}}<div>Bank: {{seller.bankName}}</div>{{/if}}
{{#if seller.bankAccount}}<div>Account (IBAN): {{seller.bankAccount}}</div>{{/if}}
{{#if seller.bankSwift}}<div>SWIFT/BIC: {{seller.bankSwift}}</div>{{/if}}
<div>Reference: {{docNumber}} / Deal {{dealCode}}</div>
</div>
{{#if notes}}<div class="paybox" style="background:#fff;border-color:#e2e2e2"><h4 style="color:#1a1a1a">Notes</h4><div>{{notes}}</div></div>{{/if}}
<div class="foot">Proforma invoice &middot; not a VAT invoice for accounting until goods are delivered &middot; {{docNumber}}</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVOICE (payment emphasis)
-- ─────────────────────────────────────────────────────────────────────────────
('invoice', 'Invoice (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.seller-name { font-size: 16px; font-weight: 700; } .title { font-size: 15px; font-weight: 700; text-align: right; color: #3c525c; }
.meta { text-align: right; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; } .party .name { font-weight: 700; } .party div { line-height: 1.4; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 12px; width: 280px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; } .totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.paybox { margin-top: 14px; border: 1px solid #3c525c; border-radius: 4px; padding: 10px 12px; background: #f4f7f8; } .paybox h4 { margin: 0 0 4px; color: #3c525c; } .paybox div { line-height: 1.5; }
.words { font-style: italic; margin-top: 8px; }
.foot { margin-top: 20px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 12mm; }
</style></head><body>
<div class="head"><div class="seller-name">{{seller.name}}</div><div class="title">{{docTitle}}</div></div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Supplier</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.regNo}}<div>Reg. No: {{seller.regNo}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}</div>
  <div class="party"><h3>Bill to</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.regNo}}<div>Reg. No: {{buyer.regNo}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}</div>
</div>
{{#if externalRefs.length}}<div class="meta" style="text-align:left;margin-top:6px">{{#each externalRefs}}<span style="margin-right:14px"><strong>{{label}}:</strong> {{value}}</span>{{/each}}</div>{{/if}}
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">m&sup3;</th><th class="num">Unit ({{currency}})</th><th class="num">Amount ({{currency}})</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td class="num">{{money unitPriceCents}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row"><span>Subtotal</span><span>{{money totals.subtotalCents}} {{currency}}</span></div>
  <div class="row"><span>VAT ({{totals.vatRate}}%)</span><span>{{money totals.vatCents}} {{currency}}</span></div>
  <div class="row grand"><span>Total due</span><span>{{moneyCur totals.totalCents}}</span></div>
</div>
<div class="words">In words: {{totals.amountInWords}}.</div>
{{#if totals.vatReference}}<div class="meta" style="text-align:left">{{totals.vatReference}}</div>{{/if}}
<div class="paybox"><h4>Payment details</h4>
{{#if paymentTerms}}<div>Terms: {{paymentTerms}}</div>{{/if}}
{{#if seller.bankName}}<div>Bank: {{seller.bankName}}</div>{{/if}}
{{#if seller.bankAccount}}<div>Account (IBAN): {{seller.bankAccount}}</div>{{/if}}
{{#if seller.bankSwift}}<div>SWIFT/BIC: {{seller.bankSwift}}</div>{{/if}}
<div>Reference: {{docNumber}} / Deal {{dealCode}}</div>
</div>
{{#if notes}}<div class="paybox" style="background:#fff;border-color:#e2e2e2"><h4 style="color:#1a1a1a">Notes</h4><div>{{notes}}</div></div>{{/if}}
<div class="foot">Generated by Timber World &middot; Invoice {{docNumber}} &middot; Deal {{dealCode}}</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PACKING LIST (no prices / no totals money — volumes and counts only)
-- ─────────────────────────────────────────────────────────────────────────────
('packing_list', 'Packing List (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.seller-name { font-size: 16px; font-weight: 700; } .title { font-size: 15px; font-weight: 700; text-align: right; }
.meta { text-align: right; color: #555; margin-top: 2px; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
.parties { display: flex; gap: 24px; } .party { flex: 1; } .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; margin: 0 0 4px; } .party .name { font-weight: 700; } .party div { line-height: 1.4; }
.terms { margin: 8px 0; color: #333; } .terms span { margin-right: 14px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 12px; width: 240px; margin-left: auto; } .totals .row { display: flex; justify-content: space-between; padding: 2px 0; } .totals .row.grand { font-weight: 700; border-top: 1px solid #b4b4b4; margin-top: 4px; padding-top: 4px; }
.notes { margin-top: 12px; } .notes h4 { margin: 0 0 3px; }
.foot { margin-top: 24px; color: #8a8a8a; font-size: 9px; border-top: 1px solid #e2e2e2; padding-top: 6px; }
@page { size: A4; margin: 12mm; }
</style></head><body>
<div class="head"><div class="seller-name">{{seller.name}}</div><div class="title">{{docTitle}}</div></div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<hr>
<div class="parties">
  <div class="party"><h3>Shipper</h3><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}</div>
  <div class="party"><h3>Consignee</h3><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}</div>
</div>
<div class="terms">{{#if incoterms}}<span>Incoterms: {{incoterms}}</span>{{/if}}{{#if deliveryTerms}}<span>Delivery: {{deliveryTerms}}</span>{{/if}}{{#if deliveryDeadline}}<span>Deadline: {{deliveryDeadline}}</span>{{/if}}</div>
<table class="items"><thead><tr><th class="num">#</th><th>Description</th><th>Dimensions (mm)</th><th class="num">Pcs</th><th class="num">Volume m&sup3;</th><th>Unit</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{fmtM3 volumeM3}}</td><td>{{unit}}</td></tr>{{/each}}</tbody></table>
<div class="totals">
  <div class="row grand"><span>Total volume</span><span>{{fmtM3 totals.totalVolumeM3}} m&sup3;</span></div>
</div>
{{#if notes}}<div class="notes"><h4>Notes</h4><div>{{notes}}</div></div>{{/if}}
<div class="foot">Packing list &middot; {{docNumber}} &middot; Deal {{dealCode}} &middot; no commercial value</div>
</body></html>',
true, true),

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CMR (consignment note — boxed layout, no prices)
-- ─────────────────────────────────────────────────────────────────────────────
('cmr', 'CMR Consignment Note (default)',
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; padding: 16px 20px; }
.title { font-size: 15px; font-weight: 700; } .subtitle { color: #555; margin-bottom: 8px; } .meta { color: #555; margin-bottom: 8px; }
.grid { display: flex; flex-wrap: wrap; gap: 8px; }
.box { border: 1px solid #333; padding: 6px 8px; flex: 1 1 46%; min-height: 56px; }
.box .lbl { font-size: 8px; text-transform: uppercase; letter-spacing: .04em; color: #3c525c; display: block; margin-bottom: 2px; }
.box .name { font-weight: 700; } .box div { line-height: 1.35; }
table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 4px 6px; font-size: 9px; }
table.items td { padding: 3px 6px; border: 1px solid #cfcfcf; font-size: 9px; vertical-align: top; } .num { text-align: right; }
.totals { margin-top: 8px; font-weight: 700; }
.signrow { display: flex; gap: 8px; margin-top: 10px; } .signrow .box { min-height: 60px; }
.foot { margin-top: 14px; color: #8a8a8a; font-size: 8px; border-top: 1px solid #e2e2e2; padding-top: 5px; }
@page { size: A4; margin: 10mm; }
</style></head><body>
<div class="title">{{docTitle}} &mdash; International Consignment Note</div>
<div class="meta">{{docNumber}} &middot; Deal {{dealCode}} &middot; {{fmtDate docDate}}</div>
<div class="grid">
  <div class="box"><span class="lbl">1. Sender (Consignor)</span><div class="name">{{seller.name}}</div>{{#if seller.address}}<div>{{seller.address}}</div>{{/if}}{{#if seller.country}}<div>{{seller.country}}</div>{{/if}}{{#if seller.vatNo}}<div>VAT: {{seller.vatNo}}</div>{{/if}}</div>
  <div class="box"><span class="lbl">2. Consignee</span><div class="name">{{buyer.name}}</div>{{#if buyer.address}}<div>{{buyer.address}}</div>{{/if}}{{#if buyer.country}}<div>{{buyer.country}}</div>{{/if}}{{#if buyer.vatNo}}<div>VAT: {{buyer.vatNo}}</div>{{/if}}</div>
  <div class="box"><span class="lbl">3. Place of delivery</span><div>{{#if buyer.address}}{{buyer.address}}{{/if}}</div>{{#if deliveryDeadline}}<div>Date: {{deliveryDeadline}}</div>{{/if}}</div>
  <div class="box"><span class="lbl">4. Place and date of taking over the goods</span><div>{{#if seller.address}}{{seller.address}}{{/if}}</div><div>Date: {{fmtDate docDate}}</div></div>
  <div class="box"><span class="lbl">5. Transport / delivery terms</span><div>{{#if incoterms}}Incoterms: {{incoterms}}{{/if}}</div><div>{{#if deliveryTerms}}{{deliveryTerms}}{{/if}}</div></div>
  <div class="box"><span class="lbl">6. Documents attached</span><div>{{#each externalRefs}}{{label}}: {{value}}<br>{{/each}}</div></div>
</div>
<table class="items"><thead><tr><th class="num">#</th><th>7. Marks and numbers / description of goods</th><th>Dimensions (mm)</th><th class="num">8. No. of packages</th><th class="num">Unit</th><th class="num">9. Volume m&sup3;</th></tr></thead>
<tbody>{{#each lineItems}}<tr><td class="num">{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td class="num">{{pieces}}</td><td class="num">{{unit}}</td><td class="num">{{fmtM3 volumeM3}}</td></tr>{{/each}}</tbody></table>
<div class="totals">Total volume: {{fmtM3 totals.totalVolumeM3}} m&sup3;</div>
{{#if notes}}<div class="box" style="margin-top:8px"><span class="lbl">15. Special agreements</span><div>{{notes}}</div></div>{{/if}}
<div class="signrow">
  <div class="box"><span class="lbl">22. Signature of sender</span></div>
  <div class="box"><span class="lbl">23. Signature of carrier</span></div>
  <div class="box"><span class="lbl">24. Goods received (consignee)</span></div>
</div>
<div class="foot">CMR consignment note &middot; {{docNumber}} &middot; Deal {{dealCode}}</div>
</body></html>',
true, true)

ON CONFLICT (doc_type) WHERE is_default DO NOTHING;
