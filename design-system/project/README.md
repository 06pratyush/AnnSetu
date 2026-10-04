AnnSetu (अन्नसेतु: *ann*, food grain, and *setu*, bridge) connects farmers with households and businesses. The system serves two sides of one bridge. Farmers work on low-end Android phones, often outdoors and in Hindi. Buyers range from someone shopping for their kitchen to a procurement desk on a laptop. Every rule below serves one of those two people.

## Principles

1. **Readable in the field.** Use high contrast and a 48px minimum touch target in the farmer area. Pair every action with an icon and a word, and make numbers big.
2. **Bilingual by default.** Every screen works in English and Hindi. Give Devanagari room: more line height, no letter-spacing, and space for strings up to 35% longer.
3. **Numbers are the product.** Every quantity carries its unit, every price says what it is per, and money uses Indian grouping.
4. **Never color alone.** Every status pairs its color with an icon and a word. Chart segments also differ in lightness and are named in a legend.
5. **Light on data.** Use two font families, photos of about 150 KB, and skeletons instead of spinners.

## Content fundamentals

- **Voice.** Plain and respectful, in short sentences. Address the reader as *you* (Hindi: *आप*). Never write *we* in the interface, except in an email confirmation ("We sent a link to …").
- **Name things by what people recognise**: *My produce*, *Stock log*, *Demand*, *Orders to act on*, not *inventory records* or *SKU*.
- **Buttons say exactly what happens**: "Accept order", "Mark delivered", "List this", "Place order". Confirmations repeat the verb ("Reject this order?" → **Reject** / **Keep order**).
- **Errors say what went wrong and how to fix it**, without apology: "Tomato has only 4 kg left. Lower the quantity and try again." "Location access is blocked. Allow it in your browser settings, or drag the pin on the map."
- **Hindi is written, not translated word for word.** Use everyday terms: बेचा गया (sold), आरक्षित (reserved), बचा हुआ (unsold), मांग (demand), पहुँचने पर नकद (cash on delivery), किलो rather than किलोग्राम in running text.
- **Numbers.** Write "120 kg", "₹32/kg", "₹1,25,000" (Indian grouping, via `Intl` with `en-IN` / `hi-IN`). Use compact money (₹1.2L) only in stat tiles. Dates are "12 Oct 2026" or "12 अक्टू॰ 2026"; recent events are relative ("2 hours ago").
- **Casing.** Use sentence case everywhere. Uppercase is only for the small English eyebrow label (`text-label-caps`); Hindi has no case and never gets letter-spacing.
- **No emoji**, in the interface or in copy.

## Color

Every color is a token with a light and a dark value, defined once in `src/styles/tokens.css`. Each text and background pair below meets WCAG AA (4.5:1) in both themes. Borders and focus rings meet 3:1.

- **Neutrals lean toward the field green.** Use `bg` for the page, `surface` for cards, sheets and inputs, and `sunken` for wells, table headers, skeletons and photo stand-ins. Body text is `ink`; secondary text is `ink-muted` (fine on `bg`, `surface` and `sunken`). Use `border` for decorative dividers. Use `border-strong` for anything that is a control outline (inputs, selects, checkboxes, secondary buttons).
- **The side of the bridge sets the chrome.**
  - The farmer area is **khet** (field green, `khet` / `khet-hover` / `khet-soft` / `on-khet`).
  - The buyer area is **neel** (indigo, `neel` / …).
  - Components never pick one directly: they use the `role` aliases (`role`, `role-hover`, `role-soft`, `on-role`). Setting `data-role="farmer"` or `data-role="buyer"` on a container switches everything inside it.
  - Primary buttons, the selected nav item and checked controls all follow the role.
- **Haldi (turmeric) means attention and demand.** Use `haldi` for fills: the "In demand" dot, cart and order counts, the outline of a new order, filled rating stars. Put `on-haldi` text on it. Use `haldi-soft` behind demand cards and accent callouts, with `haldi-ink` text. Haldi is never text on its own.
- **Focus** is a 3px solid `focus` ring (neel) with a 2px offset, on every surface.
- **Status colors**: `success`, `warning`, `danger`, `info`, each with a `*-soft` ground for badges and alerts. Destructive buttons are `danger` with `on-danger` text. Status colors never stand in for a chart series.
- **Charts** use `chart-1` … `chart-5` in that fixed order: khet, haldi, neel, mirch (chili), pudina (mint). The steps are lighter or darker than the brand colors so they pass the chart checks: lightness band, chroma floor, color-blind separation of neighbours, and 3:1 against `surface`. Gridlines are `chart-grid` hairlines. The unfilled part of a stock bar is `stock-track`.
- `scrim` sits behind dialogs and sheets.

## Typography

- **Anek Devanagari** (`--font-display`) is for headings, the wordmark and figures. **Mukta** (`--font-body`) is for everything else. Both are by Ek Type and both cover Latin and Devanagari, so a Hindi screen keeps the same voice.
- **Scale:**
  - `display`: landing headline only
  - `h1`: page titles
  - `h2`: sections and dialogs
  - `h3`: card titles, listing names
  - `kpi`: stat values, set semi-condensed (`wdth` 85)
  - `body-lg`: farmer-facing forms
  - `body`: default
  - `small`: hints, legends, meta lines
  - `label`: badges, column headers
- **Hindi**: `:lang(hi)` removes letter-spacing and raises body line height to 1.7. Never fake bold or italics on Devanagari.
- Headings balance their lines (`text-wrap: balance`). Running text stays near 65 characters wide.
- Use `tabular-nums` only where digits line up in columns. Big standalone figures keep proportional figures.

## Space, shape, depth

- **Spacing** follows a 4px base: `space-1` … `space-16` (4–64px).
  - Page gutter: `space-4` (16px) on every screen.
  - Card padding: 16px on phones, 24px from the `sm` breakpoint.
  - Sections: 32px apart.
  - Lay sibling groups out with flex/grid gaps, not margins.
- **Radius is chosen by role**:
  - `radius-sm` (6): inputs, chips, badges
  - `radius-md` (10): buttons, cards, photos
  - `radius-lg` (16): dialogs, sheets
  - `radius-full`: pills, avatars, the stock bar
- **Depth**: cards use a hairline `border` and no shadow at rest. Apply `shadow-1` to hovered cards and `shadow-2` to menus, popovers, dialogs and toasts.
- **Motion**: 150ms ease-out for press and hover, 220ms for sheets. The one signature moment is the stock bar filling in on first view. `prefers-reduced-motion` turns all of it off.

## Layout

- **Phones**: a top bar with the wordmark, language switch and account menu, plus a five-item bottom tab bar with icon and label. The main action of a form sits in a sticky bar above the tabs.
- **Desktop**: farmers get a left sidebar; buyers get a top navigation bar. Content is at most 72rem wide.
- **Nothing scrolls sideways** except a table or a chip row inside its own container.
- **Every list has three states**: a skeleton shaped like the content, an empty state (icon, what's missing, one line of help, one action), and an error with a retry.

## Data

- The **StockBar** is the signature. It splits one listing into sold (`chart-1`), reserved (`chart-2`) and unsold (`stock-track`), plus spoiled as a `danger` 135° hatch. Segments are separated by 2px `surface` gaps, rounded only at the ends, and named in a legend with quantities.
- **Charts** have one series where possible, so the title names it and no legend is needed. Columns are at most 24px wide with a 4px rounded cap. Every chart has a "Show as table" view. Labels and axis text use `ink` / `ink-muted`, never the series color.
- **Stat tiles** show a label, the value, and a hint that names its source ("From delivered orders"). A `haldi` dot marks a figure that needs action.

## Iconography

- **lucide-react only**, at 24px by default and 20px in dense rows and buttons, with a 2px stroke. Icons sit beside a word. Icon-only buttons are rare and always carry an `aria-label`.
- **Produce categories**: Carrot (vegetables), Apple (fruits), Wheat (grains), Bean (pulses), Flame (spices), Milk (dairy), Droplet (oilseeds), Sprout (others).
- **Order states**: Clock (new), CircleCheck (accepted), Package (packed), Truck (out for delivery), PackageCheck (delivered), CircleX (rejected), Ban (cancelled).
- **Photos** are farmers' own, cropped 4:3, compressed to WebP. With no photo, show the category icon in `ink-muted` on a `sunken` tile, never a stock photo.

## Identity

There is no official logo yet. The wordmark sets "AnnSetu" in Anek Devanagari 700 above its Devanagari twin "अन्नसेतु". Beside it sits a bridge arc whose farm half is `khet` and buyer half is `neel`, crowned with a `haldi` grain (`assets/Logos/annsetu-mark.svg`). Treat it as a stand-in and replace it when the project gets a mark.

## Accessibility

- WCAG 2.1 AA in both themes. Every control has a visible label; errors are linked to their field with `aria-describedby`.
- Toasts and new-order alerts are announced politely; danger alerts are announced as alerts.
- Touch targets are at least 48px in the farmer area. The full keyboard path has a visible focus ring. Layouts hold at 200% zoom and at 375px width.

## Using it in code

- **Tokens**: `src/styles/tokens.css`, mapped to Tailwind utilities in `src/app/globals.css` (`bg-surface`, `text-ink-muted`, `bg-role`, `text-haldi-ink`, `rounded-md`, `shadow-card`, `text-h2`, `font-display`).
- **Components**: `src/components/ui` (base) and `src/components/domain` (AnnSetu-specific). The live style guide is the app's `/design-system` page.
