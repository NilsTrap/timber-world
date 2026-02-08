# Production Journey Structure

**Source:** `production-journey.docx`
**Last Updated:** 2026-02-07

This document defines the 6 production stages and their processes for the marketing website.

---

## Stage Structure

| Stage | Key | Processes |
|-------|-----|-----------|
| 01 - Forest | `forest` | Maturing, Harvesting, Renewing |
| 02 - Sawmill | `sawmill` | Grading, Sawing, Stacking |
| 03 - Kiln | `kiln` | Arranging, Drying, Protecting |
| 04 - Factory | `factory` | Multisaw, Opticut, Planing, FingerJointing, Gluing, Calibrating |
| 05 - Workshop | `workshop` | CNC, Bonding, Sanding, Finishing, Packaging |
| 06 - Warehouse | `warehouse` | Controlling, Storing, Delivering, Feedback |

---

## Detailed Stage Breakdown

### Stage 01: Forest
*"Where every great piece begins — in silence, patience, and time"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Decades of Patience | `Maturing` | Decades of sun, rain, and stillness shape every oak before we ever arrive. Each ring is a promise of the strength our products will carry. |
| Respectful Harvest | `Harvesting` | We harvest only what the forest is ready to give — honouring generations of growth with the care each tree deserves. |
| Promise Renewed | `Renewing` | For every tree we take, new life returns to the land. A covenant with the future, not a policy. |

### Stage 02: Sawmill
*"The first transformation — where raw timber reveals its character"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Eye of Experience | `Grading` | Not every log meets our standard. Our specialists read the timber like a score — sensing the grain, density, and hidden potential. |
| Unlocking Potential | `Sawing` | Each saw line is placed to unlock the wood's finest expression — maximising yield while respecting its natural structure. |
| Care from the Start | `Stacking` | Quality is not something we add later. From the first board off the saw, careful handling ensures nothing is lost. |

### Stage 03: Kiln
*"The quiet discipline of drying — where patience becomes permanence"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Careful Alignment | `Arranging` | Every board stickered, spaced, and aligned with precision. Meticulous care most will never see, yet it defines the stability we deliver. |
| Gentle Release | `Drying` | We guide the moisture out gently — never rushing, never forcing. The wood tells us when it is ready, and we listen. |
| Stability Secured | `Protecting` | At ideal moisture content, timber is restacked and protected. This is where our promise of dimensional stability truly begins. |

### Stage 04: Factory
*"Precision engineering rooted in deep respect for the material"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Optimal Division | `Multisaw` | Surgical accuracy extracts optimal widths from each board. Wasting good oak means wasting the years it took to grow. |
| Nothing Wasted | `Opticut` | Intelligent crosscutting preserves every usable centimetre. Nothing worthy is left behind. |
| True Face | `Planing` | The planer reveals oak's true face — smooth, alive with grain. One of the most honest moments in our process. |
| Strength United | `FingerJointing` | Precision joints connect the finest parts of every board — eliminating waste, engineered to last as long as the solid wood itself. |
| Becoming Whole | `Gluing` | Under controlled pressure, individual lamellae become unified panels. Our adhesives are chosen for integrity, not cost. |
| Exact Promise | `Calibrating` | Wide-belt sanders bring each panel to exact thickness, measured in fractions of a millimetre. Precision you can build on. |

### Stage 05: Workshop
*"Your vision, our craftsmanship — where standard becomes bespoke"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Your Vision Shaped | `CNC` | Profiles, curves, and edges shaped to your exact specifications. Technology in the service of tradition, never the other way around. |
| Bonds That Last | `Bonding` | Every custom joint is a quiet commitment — what we build together will hold together, for the lifetime of the product. |
| Touch of Craft | `Sanding` | The surface a customer touches tells them everything about the quality behind it. We make sure it speaks well. |
| Silent Protection | `Finishing` | Each coat seals the beauty and shields against daily life. Protection that works silently for years so the oak can speak for itself. |
| Safe Passage | `Packaging` | Every surface carefully wrapped and packed before it leaves our hands. Not an afterthought — a final gesture of care. |

### Stage 06: Warehouse
*"Nothing leaves until it has earned the right to carry our name"*

| Display Title | Key | Description |
|---------------|-----|-------------|
| Earning Our Name | `Controlling` | Dimensions, moisture, surface, structure — all inspected personally. If it does not meet our standard, it does not leave our facility. |
| Trust Rewarded | `Storing` | Labelled, documented, secured. The trust you place in us is rewarded in every detail. |
| Into Your Hands | `Delivering` | The last physical act of care our team performs. Tracked, reliable, respected cargo — a product is only truly finished when it arrives safely in your hands. |
| Growing Together | `Feedback` | We ask, we listen, we learn. Your voice shapes our future, and we are grateful for every word. |

---

## Image Naming Convention

Images should be placed in `apps/marketing/public/images/journey/` with the following structure:

### Stage Images (main backgrounds)
- `forest.jpg`
- `sawmill.jpg`
- `kiln.jpg`
- `factory.jpg`
- `workshop.jpg`
- `warehouse.jpg`

### Process Images (gallery)
Format: `{stage}-{process}.jpg` (lowercase)

**Forest:**
- `forest-maturing.jpg`
- `forest-harvesting.jpg`
- `forest-renewing.jpg`

**Sawmill:**
- `sawmill-grading.jpg`
- `sawmill-sawing.jpg`
- `sawmill-stacking.jpg`

**Kiln:**
- `kiln-arranging.jpg`
- `kiln-drying.jpg`
- `kiln-protecting.jpg`

**Factory:**
- `factory-multisaw.jpg`
- `factory-opticut.jpg`
- `factory-planing.jpg`
- `factory-fingerjointing.jpg`
- `factory-gluing.jpg`
- `factory-calibrating.jpg`

**Workshop:**
- `workshop-cnc.jpg`
- `workshop-bonding.jpg`
- `workshop-sanding.jpg`
- `workshop-finishing.jpg`
- `workshop-packaging.jpg`

**Warehouse:**
- `warehouse-controlling.jpg`
- `warehouse-storing.jpg`
- `warehouse-delivering.jpg`
- `warehouse-feedback.jpg`

---

## Changes from Previous Version

| Previous | New |
|----------|-----|
| 8 stages | 6 stages |
| kilns (plural) | kiln (singular) |
| elements | factory |
| cnc → Tailoring | workshop |
| finishing (separate) | merged into workshop |
| qualityControl + delivery | warehouse |
| Growing | Maturing |
| Logging | Harvesting |
| Planting | Renewing |
| Selection | Grading |
| Cutting | Sawing |
| Packing (sawmill) | Stacking |
| Loading (kiln) | Arranging |
| Packing (kiln) | Protecting |
| Machining | CNC |
| Gluing (cnc) | Bonding |
| Varnishing/Waxing | Finishing |
| StretchFoiling/BoxPacking | Packaging |
| Checking | Controlling |
| Packing (QC) | Storing |
| Loading/Transporting | Delivering |
