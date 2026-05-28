import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Agent Manual" };

const AGENT_APP_URL = "https://timber-agents-app.vercel.app";

const h2 = "text-xl font-semibold tracking-tight scroll-mt-24 border-b pb-2";
const h3 = "text-base font-semibold mt-5 mb-1";
const p = "text-sm leading-relaxed text-muted-foreground";
const ul = "list-disc pl-5 space-y-1 text-sm text-muted-foreground";
const ol = "list-decimal pl-5 space-y-2 text-sm";
const code = "rounded bg-muted px-1.5 py-0.5 text-xs font-mono";
const card = "rounded-lg border bg-card p-5 space-y-3";
const th = "text-left px-3 py-2 font-medium";
const td = "px-3 py-2 align-top border-t";

export default async function AgentManualPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agent Manual</h1>
        <p className="text-muted-foreground">
          A quick reference for running the timber catalog and the Timber Agents app — what lives where, how to set
          things up, and how the pricing and commission logic works.
        </p>
      </div>

      {/* Two surfaces */}
      <section id="overview" className="space-y-3">
        <h2 className={h2}>1. The two surfaces</h2>
        <p className={p}>
          There are two connected products. You work almost entirely in the <strong>admin portal</strong> (this site).
          Agents use the separate <strong>Timber Agents</strong> mobile app.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={th}>Surface</th>
                <th className={th}>URL</th>
                <th className={th}>Used by</th>
                <th className={th}>For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td}>Admin portal</td>
                <td className={td}>this site (where you are now)</td>
                <td className={td}>You</td>
                <td className={td}>Manage the catalog, approve agents, review agent orders</td>
              </tr>
              <tr>
                <td className={td}>Timber Agents app</td>
                <td className={td}>
                  <a className="text-primary hover:underline" href={AGENT_APP_URL}>{AGENT_APP_URL}</a>
                </td>
                <td className={td}>Agents (on their phones)</td>
                <td className={td}>Browse products in GBP, see commission, place orders</td>
              </tr>
              <tr>
                <td className={td}>Agent sign-up</td>
                <td className={td}>
                  <a className="text-primary hover:underline" href={`${AGENT_APP_URL}/register`}>{AGENT_APP_URL}/register</a>
                </td>
                <td className={td}>New agents</td>
                <td className={td}>Apply to become an agent (needs your approval)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick map of admin pages */}
      <section id="admin-map" className="space-y-3">
        <h2 className={h2}>2. Where things live in the portal</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className={th}>I want to…</th><th className={th}>Go to</th></tr>
            </thead>
            <tbody>
              <tr><td className={td}>Create / edit categories</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog">Catalog → Categories</Link></td></tr>
              <tr><td className={td}>See all products in one list</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog/products">Catalog → Products</Link></td></tr>
              <tr><td className={td}>Manage reusable fields (Species, Quality…)</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog/fields">Catalog → Fields</Link></td></tr>
              <tr><td className={td}>Define package types (pieces per pack)</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog/packaging">Catalog → Packaging</Link></td></tr>
              <tr><td className={td}>Set up units (m², m³, m, piece)</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog/pricing-units">Catalog → Pricing Units</Link></td></tr>
              <tr><td className={td}>Manage currencies &amp; GBP conversion</td><td className={td}><Link className="text-primary hover:underline" href="/admin/catalog/currencies">Catalog → Currencies</Link></td></tr>
              <tr><td className={td}>Approve / reject agents</td><td className={td}><Link className="text-primary hover:underline" href="/admin/agents">Agents</Link></td></tr>
              <tr><td className={td}>Review &amp; confirm agent orders</td><td className={td}><Link className="text-primary hover:underline" href="/admin/agent-orders">Agent Orders</Link></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Catalog structure */}
      <section id="structure" className="space-y-3">
        <h2 className={h2}>3. How the catalog is structured</h2>
        <p className={p}>The catalog has three levels, plus a few shared building blocks:</p>
        <ul className={ul}>
          <li><strong>Category</strong> — a product group, e.g. “Solid Wood Panels”. Holds the category image, the pricing unit, and the agent commission rates.</li>
          <li><strong>Product</strong> — a specific item inside a category, e.g. “Oak Full Stave Panel”. Holds the description, product images, and field values (Species, Quality, etc.).</li>
          <li><strong>Variant</strong> — a buyable size of a product, e.g. 18 × 600 × 2000 mm. Holds the SKU, dimensions, price, stock, packaging and variant images. This is what an agent actually adds to a cart.</li>
        </ul>
        <p className={p}>Shared building blocks used across categories:</p>
        <ul className={ul}>
          <li><strong>Fields</strong> — reusable attributes (Species, Quality, Panel Type…). Defined once, then assigned to any category. Become the filters agents see.</li>
          <li><strong>Packaging</strong> — named pack types with a <em>pieces-per-package</em> count.</li>
          <li><strong>Pricing Units</strong> — m², m³, m or piece, each with a calculation method (see §6).</li>
          <li><strong>Currencies</strong> — EUR is the base; GBP is derived (see §5).</li>
        </ul>
      </section>

      {/* Create a category */}
      <section id="category" className="space-y-3">
        <h2 className={h2}>4. Creating a category</h2>
        <p className={p}>Go to <Link className="text-primary hover:underline" href="/admin/catalog">Catalog → Categories</Link> and add a category. Open it to find three tabs: <strong>Category</strong>, <strong>Products</strong>, <strong>Fields</strong>.</p>
        <div className={card}>
          <h3 className={h3}>On the Category tab you set:</h3>
          <ul className={ul}>
            <li><strong>Name, slug, description</strong> — the slug is the URL-safe id; change it with care.</li>
            <li><strong>Category image</strong> — Upload / Replace / Remove. Shown on the agent catalog and home screen (JPEG / PNG / WebP).</li>
            <li><strong>Primary pricing unit</strong> — e.g. m². Drives how quantities and prices are expressed for everything in this category.</li>
            <li><strong>Agent commission</strong> — three percentages (see §7).</li>
          </ul>
        </div>
        <div className={card}>
          <h3 className={h3}>On the Fields tab:</h3>
          <p className={p}>Assign the reusable fields this category should use (e.g. Species, Quality). Pick whether each field applies to the <em>product</em> or the <em>variant</em>, and the order. Select-type fields assigned at product level become the filter chips agents see.</p>
        </div>
      </section>

      {/* Products + variants */}
      <section id="products" className="space-y-3">
        <h2 className={h2}>5. Adding products and variants</h2>
        <ol className={ol}>
          <li><strong>Add a product</strong> inside the category (Products tab, or <Link className="text-primary hover:underline" href="/admin/catalog/products">Catalog → Products</Link>). Give it a name, description and field values. Upload one or more product images — the first/primary one is the cover.</li>
          <li><strong>Add variants</strong> on the product page. The variants table is inline-editable:
            <ul className={ul}>
              <li><strong>SKU</strong> — read-only first column (sensitive; not editable here).</li>
              <li><strong>Dimensions</strong> — thickness × width × length in mm.</li>
              <li><strong>Price (EUR)</strong> — per unit. Leave blank to inherit the product price; set it to override for this variant.</li>
              <li><strong>Stock</strong> — a number plus a unit toggle: <code className={code}>pc</code> (pieces) or <code className={code}>pkg</code> (packages). It is shown to agents converted into the base unit (e.g. m²).</li>
              <li><strong>Packaging</strong> — pick the default pack type (sets pieces-per-package).</li>
              <li><strong>Active</strong> — only active variants appear in the app.</li>
            </ul>
          </li>
          <li><strong>Variant images</strong> — optional; shown in a swipeable gallery and as thumbnails in the variant list.</li>
        </ol>
        <p className={p}>Prices are entered in EUR only. GBP is generated automatically — see next section.</p>
      </section>

      {/* Pricing & currency */}
      <section id="pricing" className="space-y-3">
        <h2 className={h2}>6. Pricing &amp; the EUR → GBP conversion</h2>
        <p className={p}><strong>EUR is the single source of truth.</strong> You only ever type EUR prices. The agent app shows GBP.</p>
        <ul className={ul}>
          <li>On <Link className="text-primary hover:underline" href="/admin/catalog/currencies">Catalog → Currencies</Link>, press <strong>“Update prices”</strong> to fetch the latest ECB exchange rate and recompute every GBP price.</li>
          <li>Converted prices are then passed through a <strong>charm-rounding</strong> rule so they end on tidy numbers. The rule is a set of bands, checked top to bottom — the first matching “up to” wins; leave the last band’s limit empty for “and above”. Prices always round <em>up</em> to the charm price.</li>
          <li>You can set a <strong>manual GBP override</strong> on a variant. Manual overrides are kept and are <em>not</em> overwritten the next time you run “Update prices” (marked with a ✎).</li>
        </ul>
        <p className={p}>Price resolution order for a variant: <em>variant price → product price → (category)</em>. The first one set wins.</p>
      </section>

      {/* Units */}
      <section id="units" className="space-y-3">
        <h2 className={h2}>7. Pricing units &amp; how quantities are calculated</h2>
        <p className={p}>Each pricing unit has a calculation method that turns a variant’s dimensions into a billable quantity per piece:</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className={th}>Method</th><th className={th}>Unit</th><th className={th}>Quantity per piece</th></tr>
            </thead>
            <tbody>
              <tr><td className={td}>Area</td><td className={td}>m²</td><td className={td}>width × length (in metres)</td></tr>
              <tr><td className={td}>Volume</td><td className={td}>m³</td><td className={td}>width × length × thickness</td></tr>
              <tr><td className={td}>Length</td><td className={td}>m</td><td className={td}>length</td></tr>
              <tr><td className={td}>Per piece</td><td className={td}>piece</td><td className={td}>1</td></tr>
            </tbody>
          </table>
        </div>
        <p className={p}>
          Example: an 18 × 600 × 2000 mm panel priced per m² has 0.6 × 2.0 = 1.2 m² per piece. A pack of 10 pieces is
          12 m², and the pack price is the m² price × 12.
        </p>
      </section>

      {/* Commissions */}
      <section id="commissions" className="space-y-3">
        <h2 className={h2}>8. Agent commissions</h2>
        <p className={p}>Commission is configured <strong>per category</strong> with three percentages. You only enter percentages — the money is computed from the sale price.</p>
        <ul className={ul}>
          <li><strong>Standard %</strong> — the agent’s commission when they sell at full price (no discount).</li>
          <li><strong>Max discount %</strong> — the largest discount an agent may give. This becomes the slider limit in the app.</li>
          <li><strong>Commission % at max discount</strong> — the (lower) commission rate when the agent gives the full discount.</li>
        </ul>
        <div className={card}>
          <h3 className={h3}>The discount is company-funded</h3>
          <p className={p}>
            A discount is <strong>not</strong> taken out of the agent’s commission. Instead, when an agent discounts, the
            company earns less <em>and</em> pays a lower commission rate. The rate slides linearly from the Standard % (at
            0 discount) down to the Commission-at-max % (at the max discount). Commission is always paid on the
            <strong> final, discounted</strong> sale price.
          </p>
        </div>
        <div className={card}>
          <h3 className={h3}>Worked example</h3>
          <p className={p}>Category set to: Standard 20%, Max discount 20%, Commission at max 10%. Pack price £100.</p>
          <ul className={ul}>
            <li>No discount → rate 20% → commission = 20% of £100 = <strong>£20</strong>.</li>
            <li>10% discount (halfway) → rate 15% → final price £90 → commission = <strong>£13.50</strong>.</li>
            <li>20% discount (max) → rate 10% → final price £80 → commission = <strong>£8</strong>.</li>
          </ul>
        </div>
        <p className={p}>In v1 all agents use the same commission terms. Each agent can hide prices &amp; commission in the app via a personal toggle (you can also see/keep this per agent).</p>
      </section>

      {/* Agents */}
      <section id="agents" className="space-y-3">
        <h2 className={h2}>9. Agents: sign-up &amp; approval</h2>
        <ol className={ol}>
          <li>A prospective agent opens <a className="text-primary hover:underline" href={`${AGENT_APP_URL}/register`}>{AGENT_APP_URL}/register</a> and submits first name, surname, email, <strong>phone (required)</strong> and a password. No email confirmation is required; bank/payout details come later.</li>
          <li>The application lands as <strong>Pending</strong> on <Link className="text-primary hover:underline" href="/admin/agents">Agents</Link>. Until you act, they cannot use the app.</li>
          <li>Press <strong>Approve</strong> to let them in, or <strong>Reject</strong> to decline. Approved agents can log in and start ordering immediately.</li>
        </ol>
      </section>

      {/* Agent orders */}
      <section id="orders" className="space-y-3">
        <h2 className={h2}>10. Agent orders</h2>
        <p className={p}>An order is a <strong>request</strong> from an agent that you then confirm or cancel. Stock is not decremented automatically in v1.</p>
        <p className={p}>Lifecycle, visible on <Link className="text-primary hover:underline" href="/admin/agent-orders">Agent Orders</Link>:</p>
        <ul className={ul}>
          <li><strong>Cart</strong> — the agent is still building it; not yet submitted.</li>
          <li><strong>Submitted</strong> — sent to you. Open it, review the line items and commission, then <strong>Confirm</strong> or <strong>Cancel</strong>.</li>
          <li><strong>Confirmed</strong> / <strong>Cancelled</strong> — your decision.</li>
        </ul>
        <p className={p}>
          Each order has a code like <code className={code}>AO-0001</code>. Every line item is a <strong>snapshot</strong>:
          the product name, dimensions, SKU, unit price, quantity, discount and commission are frozen at submit time, so
          later catalog or price changes never alter a placed order.
        </p>
      </section>

      <p className="text-xs text-muted-foreground border-t pt-4">
        This manual covers the catalog and agent-ordering features. The agent app itself is intentionally simple and
        self-explanatory, so it is not documented here.
      </p>
    </div>
  );
}
