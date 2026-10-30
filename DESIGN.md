# Agent Fernandez: design plan

Written before any code, following the `frontend-design` skill: plan, review against the brief, build, critique.

## Subject, audience, job

- **Subject:** an independent residential agent's site. Its job is to present a small, curated book of homes and to start conversations with buyers and sellers.
- **Audience:** buyers browsing on phones in the evening, and sellers comparing agents before a listing appointment.
- **Primary job:** make each home look its best, and make reaching Agent Fernandez feel effortless and personal.

## Concept: "the particulars"

The vernacular of fine property is the printed brochure, or *particulars*: a large, carefully cropped photograph, the address set like a title, and a measured schedule of facts (rooms, area, lot, year). The site borrows that object rather than the SaaS-card kit:

- Photographs sit on ivory like mounted prints, with a narrow mat. There are no shadows and no rounded cards.
- Facts are set as a definition list with tabular figures, like a schedule, not as icon chips.
- The one bold move is the **hero plate**: an edge-to-edge photograph of the featured home that unveils once on load. The address and price sit beneath it like a caption on a gallery wall. Everything else stays quiet.

## Tokens

| Name | Hex | Role |
| --- | --- | --- |
| Ivory | `#F5F0E6` | Page ground |
| Linen | `#EAE2D4` | Recessed bands, field backgrounds, image placeholder |
| Taupe | `#B3A592` | Hairlines, mats, decorative only (never text) |
| Taupe ink | `#6B5E50` | Secondary text (5.5:1 on Ivory) |
| Charcoal | `#2F2D2A` | Text, primary buttons, footer ground |
| Charcoal soft | `#4A4642` | Hover state for charcoal surfaces |

There is no accent hue. The photography supplies the colour, and the brand stays neutral like a gallery wall. Status (Active, Pending, Sold) is written out in words, not colour-coded.

**Type**
- *Newsreader* (variable, optical size): addresses, headings, prices. Set at weight 360–420, with no italics used as accents.
- *Albert Sans* (variable): body text, UI, facts, forms. Weight 400 for text and 560 for buttons and labels. Tabular numerals for prices and facts.
- Scale (≈1.25, rounded): 14 / 16 / 18 / 22 / 28 / 36 / 48 / 68 / 92 px. Body is 17px with line-height 1.6. Measure is held at 62–70ch.
- Sentence case everywhere. No all-caps eyebrows.

**Shape:** 2px radius on images, inputs and buttons. Taupe 1px hairlines separate content only where the content changes.

**Layout:** a left-aligned, asymmetric 12-column grid with a max width of 1360px. Gutters are 16px on mobile and 32–56px on desktop.

```
Home (desktop)
┌───────────────────────────────────────────────┐
│ Agent Fernandez          Homes  Buy  Sell  Contact│
│┌─────────────────────────────────────────────┐│
││          hero photograph (16:9, mat)          ││
│└─────────────────────────────────────────────┘│
│ Homes chosen with care,          1180 Alder Way │
│ sold with patience.              Offered at $2.4M│
│                                                 │
│ Current homes ─────────────────────────────────  │
│ [photo 7col          ] [photo 5col]              │
│ address / facts        address / facts           │
│ [photo 5col] [photo 7col          ]              │
│                                                 │
│ Buying ┃ Selling   (two columns, plain text + one action each)│
│ About Kevin (text, measure 62ch)                 │
│ Contact form                                     │
└───────────────────────────────────────────────┘
```

The listings grid alternates 7/5 and 5/7 column spans, like a magazine spread, instead of rows of identical cards. On mobile it collapses to a single column.

## Motion

- **One orchestrated moment:** the hero plate unveils with a clip-path reveal from the bottom edge while the image settles from 1.04 to 1.0 scale (900ms), then the headline fades in.
- **Responsive motion only, after that:** gallery crossfade on photo change, filter results swapping via the View Transitions API where supported, form submission states, and the mobile menu opening.
- There are no scroll-triggered section fades and no card hover zooms. `prefers-reduced-motion` turns all motion off.

## Review against the brief (what changed)

1. *First draft:* an ivory ground, a high-contrast Didone display and a muted terracotta accent. The skill flags that combination (cream, high-contrast serif and clay accent) as the commonest generated look. The brief does fix the palette (ivory, taupe, charcoal), so the palette stays. **Changed:** dropped the clay accent entirely, and replaced the Didone with Newsreader, a text-born serif with optical sizing that reads as editorial rather than fashion.
2. *First draft:* listing cards with a shadow, rounded corners and bed/bath icons. **Changed:** mounted photographs with a caption and a facts schedule. That is the real-estate brochure vernacular, and it is not a component-kit card.
3. *First draft:* a "01 / 02 / 03" treatment on Buy/Sell/About. **Changed:** numbering is used only on the seller process, which really is a sequence.
4. *First draft:* arrows on every link and a tracked-out "FEATURED" label. **Changed:** removed both. Section titles are plain sentence-case headings.

## Copy rules

Plain verbs, sentence case and specific actions: "Ask about this home", "Request a valuation", "Send message". Errors say what went wrong and how to fix it. Empty states invite action.
