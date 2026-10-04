// The AnnSetu component catalogue for the Design System artifact: guideline, live preview and
// props for each component the app exports. Previews mount window.AnnSetu.<Comp> with example data.

const mount = (body) => `<div id="root" class="bg-bg p-4 text-ink"></div>
<script>
const A = window.AnnSetu; const h = React.createElement; const S = A.samples;
function Demo() {
${body}
}
ReactDOM.createRoot(document.getElementById("root")).render(h(Demo));
</script>`;

export const COMPONENTS = [
  // ------------------------------------------------------------------ Actions
  {
    name: "Button",
    group: "Actions",
    height: 160,
    readme: `Button runs one action and says exactly what it does ("Accept order", "स्टॉक जोड़ें").

**Use** \`primary\` for the one main action on a screen; it takes the role color (\`role\`: khet in the farmer area, neel in the buyer area). \`secondary\` for other actions, \`outline\` for "List this" style shortcuts, \`accent\` (haldi) only for ratings and demand calls, \`destructive\` only inside a confirm step, \`ghost\` for low-emphasis actions in rows.

**Sizes**: \`md\` is 48px, the minimum in the farmer area. Use \`lg\` (56px) for the primary action of a form or page, \`sm\` (40px) only in dense desktop rows.

**Provide** a text label, always. Icon-only buttons (\`icon\`, \`icon-sm\`) need an \`aria-label\`. Pass \`loading\` while a request runs; the button disables itself and shows a spinner.

**Don't** put two primary buttons side by side, or use color as the only difference between actions.`,
    dts: `export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "accent" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
  /** Render the child (e.g. a link) with button styling. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}`,
    preview: mount(`  return h("div", { className: "flex flex-col gap-4" },
    h(A.RoleScope, { role: "farmer" }, h("div", { className: "flex flex-wrap gap-3" },
      h(A.Button, null, "List produce"), h(A.Button, { variant: "secondary" }, "Edit"), h(A.Button, { variant: "outline" }, "List this"), h(A.Button, { variant: "ghost" }, "Cancel"))),
    h(A.RoleScope, { role: "buyer" }, h("div", { className: "flex flex-wrap gap-3" },
      h(A.Button, { size: "lg" }, "Place order"), h(A.Button, { variant: "accent" }, "Rate this order"), h(A.Button, { variant: "destructive" }, "Reject"), h(A.Button, { loading: true }, "Saving…"))));`),
  },

  // ------------------------------------------------------------------ Inputs
  {
    name: "Field",
    group: "Inputs",
    height: 300,
    readme: `Field puts a label above one control, then its hint or its error, and wires them together for screen readers.

**Provide** an \`id\`, a \`label\` and exactly one control as the child (\`Input\`, \`UnitInput\`, \`NativeSelect\`, \`Textarea\`, \`ChipInput\`). Field injects \`id\`, \`aria-describedby\` and \`aria-invalid\` into it.

**Errors** replace the hint, are written as what to do ("Enter a 10-digit mobile number."), and turn the control's border \`danger\` on \`danger-soft\`. Mark optional fields with \`optional\` instead of starring required ones.

**Controls**: \`Input\` and \`NativeSelect\` are 48px tall with \`border-strong\` outlines. Use \`NativeSelect\` rather than a custom dropdown: the phone's own picker is easiest on low-end Android. \`UnitInput\` shows the unit (\`kg\`, \`₹/kg\`) as a fixed suffix.`,
    dts: `export interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Replaces the hint and marks the control invalid. */
  error?: string;
  /** Text for the "(optional)" marker. */
  optional?: string;
  className?: string;
  children: React.ReactElement;
}
export interface UnitInputProps extends React.InputHTMLAttributes<HTMLInputElement> { unit: string }`,
    preview: mount(`  return h("div", { className: "grid gap-4 sm:grid-cols-2" },
    h(A.Field, { id: "f1", label: "Produce name", hint: "e.g. Tomato" }, h(A.Input, { defaultValue: "Tomato" })),
    h(A.Field, { id: "f2", label: "Mobile number", error: "Enter a 10-digit mobile number." }, h(A.Input, { defaultValue: "98765" })),
    h(A.Field, { id: "f3", label: "Price per kg (₹)" }, h(A.UnitInput, { unit: "₹/kg", defaultValue: 32 })),
    h(A.Field, { id: "f4", label: "Variety", optional: "optional" }, h(A.NativeSelect, { defaultValue: "desi" }, h("option", { value: "desi" }, "Desi"), h("option", { value: "hybrid" }, "Hybrid"))));`),
  },
  {
    name: "QuantityStepper",
    group: "Inputs",
    height: 110,
    readme: `QuantityStepper sets an order quantity with big − and + targets and a typed value, clamped between the minimum order and the stock available.

**Provide** \`value\`, \`onChange\`, \`unit\`, an accessible \`label\`, and \`min\` / \`max\` from the listing (\`min_order_qty\`, \`qty_available\`).

**Use** it on the product page and in cart lines. Each button is 48px; the unit sits inside the field so "10" never appears without "kg".`,
    dts: `export interface QuantityStepperProps {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  label: string;
  id?: string;
}`,
    preview: mount(`  const [q, setQ] = React.useState(10);
  return h("div", { className: "flex flex-wrap items-center gap-6" },
    h(A.QuantityStepper, { value: q, onChange: setQ, min: 5, max: 24, unit: "kg", label: "Quantity of tomato" }),
    h(A.Lang, { lang: "hi" }, h(A.QuantityStepper, { value: 2, onChange: function () {}, min: 2, max: 23, unit: "quintal", label: "गेहूँ की मात्रा" })));`),
  },
  {
    name: "Checkbox",
    group: "Inputs",
    height: 120,
    readme: `Checkbox is a yes/no choice with its label and an optional description; the whole row is the 48px target.

**Provide** an \`id\`, a \`label\`, and \`checked\` / \`onCheckedChange\` (or \`defaultChecked\`). The checked box fills with \`role\`.

**Use** Switch instead when the change applies immediately (a filter), Checkbox inside forms that save.`,
    dts: `export interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(checked: boolean | "indeterminate"): void;
}`,
    preview: mount(`  return h(A.Checkbox, { id: "c1", label: "Organic", description: "Grown without chemical fertiliser or pesticide.", defaultChecked: true });`),
  },
  {
    name: "Switch",
    group: "Inputs",
    height: 80,
    readme: `Switch turns a setting on or off immediately, with no save step.

**Provide** an \`aria-label\` or a visible label next to it, and \`checked\` / \`onCheckedChange\`. On, it fills with \`role\`; off, it sits on \`sunken\` with a \`border-strong\` outline.`,
    dts: `export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onCheckedChange?(checked: boolean): void; "aria-label"?: string }`,
    preview: mount(`  return h("label", { className: "flex items-center gap-3 text-body" }, h(A.Switch, { defaultChecked: true, "aria-label": "Organic only" }), "Organic only");`),
  },
  {
    name: "ChipInput",
    group: "Inputs",
    height: 110,
    readme: `ChipInput collects short free-text tags, such as a farmer's main crops: type, press Enter or comma, remove with the chip's own button.

**Provide** \`value\`, \`onChange\` and \`removeLabel(item)\` for each chip's accessible name. Chips sit on \`role-soft\`.`,
    dts: `export interface ChipInputProps {
  id?: string;
  value: string[];
  onChange(value: string[]): void;
  max?: number;
  removeLabel(item: string): string;
}`,
    preview: mount(`  const [v, setV] = React.useState(["Tomato", "Onion", "Wheat"]);
  return h(A.ChipInput, { value: v, onChange: setV, removeLabel: function (c) { return "Remove " + c; } });`),
  },
  {
    name: "RoleChoiceCards",
    group: "Inputs",
    height: 270,
    readme: `RoleChoiceCards is the sign-up choice between Farmer, Individual buyer and Industrial buyer: three large radio cards.

Each card scopes \`data-role\` to its side, so the farmer card selects in khet green and the buyer cards in neel indigo. That way the color of the side is learned at the very first screen.

**Provide** \`value\` and \`onChange\`. Wrap in a fieldset with a visible legend ("I am a…").`,
    dts: `export type AccountChoice = "farmer" | "individual" | "industrial";
export interface RoleChoiceCardsProps { value: AccountChoice | null; onChange(v: AccountChoice): void; className?: string; name?: string }`,
    preview: mount(`  const [v, setV] = React.useState("farmer");
  return h(A.RoleChoiceCards, { value: v, onChange: setV });`),
  },
  {
    name: "LanguageToggle",
    group: "Inputs",
    height: 80,
    readme: `LanguageToggle switches the whole interface between English and Hindi. Each option is labelled in its own language (EN, हिं) so a reader can always find theirs.

It lives in every header. The choice is remembered on the device and, when signed in, saved to the profile. The \`html\` element's \`lang\` follows it, so Hindi gets its Devanagari line height and no letter-spacing.`,
    dts: `export interface LanguageToggleProps { className?: string; onChange?(lang: "en" | "hi"): void }`,
    preview: mount(`  return h("div", { className: "flex gap-4" }, h(A.LanguageToggle), h(A.ThemeToggle));`),
  },
  {
    name: "CategoryChips",
    group: "Inputs",
    height: 120,
    readme: `CategoryChips is the single-choice category filter above the market: All, Vegetables, Fruits, Grains, Pulses, Spices, Dairy, Oilseeds, Others.

On phones the row scrolls sideways inside itself rather than wrapping into a wall. The selected chip fills with \`role\`; each category carries its lucide icon.`,
    dts: `export type CategorySlug = "vegetables" | "fruits" | "grains" | "pulses" | "spices" | "dairy" | "oilseeds" | "others";
export interface CategoryChipsProps { value: CategorySlug | "all"; onChange(v: CategorySlug | "all"): void; className?: string }`,
    preview: mount(`  const [v, setV] = React.useState("all");
  return h(A.RoleScope, { role: "buyer" }, h(A.CategoryChips, { value: v, onChange: setV }));`),
  },
  {
    name: "SearchFilterBar",
    group: "Inputs",
    height: 130,
    readme: `SearchFilterBar is the one row of market controls: search, "Organic only", and sort (newest, price low to high, price high to low).

**Provide** each value with its setter. Keep filters in this one row above results; don't scatter them through the page.`,
    dts: `export type MarketSort = "newest" | "price_asc" | "price_desc";
export interface SearchFilterBarProps {
  query: string; onQuery(q: string): void;
  sort: MarketSort; onSort(s: MarketSort): void;
  organic: boolean; onOrganic(v: boolean): void;
}`,
    preview: mount(`  const [q, setQ] = React.useState("tomato"); const [s, setS] = React.useState("newest"); const [o, setO] = React.useState(true);
  return h(A.SearchFilterBar, { query: q, onQuery: setQ, sort: s, onSort: setS, organic: o, onOrganic: setO });`),
  },
  {
    name: "RatingStars",
    group: "Inputs",
    height: 120,
    readme: `RatingStars shows a farmer's average rating, or with \`onChange\` lets a buyer rate a delivered order from 1 to 5.

Filled stars are \`haldi\` with a \`haldi-ink\` outline; empty ones \`border-strong\`. The number is always printed next to the stars (or read out), so the rating never depends on counting icons. Input stars are 48px radio buttons.`,
    dts: `export interface RatingStarsProps { value: number | null; onChange?(v: number): void; count?: number; size?: "sm" | "md" }`,
    preview: mount(`  const [r, setR] = React.useState(4);
  return h("div", { className: "flex flex-col gap-3" }, h(A.RatingStars, { value: 4.6, count: 18 }), h(A.RatingStars, { value: r, onChange: setR }));`),
  },
  {
    name: "PhotoUploader",
    group: "Inputs",
    height: 220,
    readme: `PhotoUploader adds up to four listing photos from the camera or gallery, previews them 4:3, and lets each be removed.

Photos are shrunk on the device to about 150 KB WebP before upload, so listings load on 3G and the free storage lasts. **Provide** \`items\` and \`onChange\`; the parent uploads files on save.`,
    dts: `export interface PhotoItem { key: string; url: string; file?: File }
export interface PhotoUploaderProps { items: PhotoItem[]; onChange(items: PhotoItem[]): void; max?: number; disabled?: boolean }`,
    preview: mount(`  const [items, setItems] = React.useState([]);
  return h(A.PhotoUploader, { items: items, onChange: setItems });`),
  },
  {
    name: "Tabs",
    group: "Inputs",
    height: 100,
    readme: `Tabs switch between views of one list (Active, Completed, All orders; On sale, Paused, Sold out listings). The active tab has a 3px \`role\` underline; counts sit in a \`sunken\` pill.`,
    dts: `export interface TabsProps { value?: string; defaultValue?: string; onValueChange?(v: string): void; children: React.ReactNode }`,
    preview: mount(`  return h(A.Tabs, { defaultValue: "active" }, h(A.TabsList, null,
    h(A.TabsTrigger, { value: "active" }, "Active"), h(A.TabsTrigger, { value: "completed" }, "Completed"), h(A.TabsTrigger, { value: "all" }, "All")));`),
  },

  // ------------------------------------------------------------------ Feedback
  {
    name: "Badge",
    group: "Feedback",
    height: 100,
    readme: `Badge labels a state in a few words, on a soft fill with its matching text color (\`success\` on \`success-soft\`, and so on; each pair is at least 4.5:1).

Status badges always carry an icon and a word, never color alone. \`role\` tone for neutral highlights of the current side, \`accent\` (haldi) for demand.`,
    dts: `export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "role" | "accent" | "success" | "warning" | "danger" | "info" | "outline";
}`,
    preview: mount(`  return h("div", { className: "flex flex-wrap gap-2" },
    h(A.Badge, { tone: "success" }, "On sale"), h(A.Badge, { tone: "warning" }, "Paused"), h(A.Badge, { tone: "neutral" }, "Sold out"),
    h(A.Badge, { tone: "accent" }, "In demand"), h(A.Badge, { tone: "info" }, "Industrial"), h(A.OrganicBadge));`),
  },
  {
    name: "Alert",
    group: "Feedback",
    height: 230,
    readme: `Alert is an inline message about the current screen: success, warning, danger, info, or accent (haldi) for demand context.

Write it as what happened and what to do next, without apologies ("Couldn't look up the address. Type it in below."). Danger alerts are announced as alerts; the others politely.`,
    dts: `export interface AlertProps { tone?: "info" | "success" | "warning" | "danger" | "accent"; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }`,
    preview: mount(`  return h("div", { className: "flex flex-col gap-3" },
    h(A.Alert, { tone: "success" }, "Address filled from your location. Check it and correct anything that's off."),
    h(A.Alert, { tone: "danger" }, "Tomato has only 4 kg left. Lower the quantity and try again."),
    h(A.Alert, { tone: "accent" }, "Listing for a buyer request: Onion"));`),
  },
  {
    name: "EmptyState",
    group: "Feedback",
    height: 310,
    readme: `EmptyState fills every list that has nothing in it yet: an icon, what's missing, one line of help, and one action.

**Provide** a lucide \`icon\`, \`title\`, optional \`body\` and \`action\`. Never leave a blank area where a list would be.`,
    dts: `export interface EmptyStateProps { icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }`,
    preview: mount(`  return h(A.RoleScope, { role: "farmer" }, h(A.EmptyState, { icon: function (p) { return h(A.CategoryIcon, Object.assign({ category: "grains" }, p)); }, title: "Nothing listed yet", body: "List your first crop so buyers can find it.", action: h(A.Button, null, "List produce") }));`),
  },
  {
    name: "ConfirmDialog",
    group: "Feedback",
    height: 300,
    readme: `ConfirmDialog asks before anything destructive or hard to undo: rejecting or cancelling an order, archiving a listing.

The title is the question ("Reject this order?"), the body says the consequence ("the reserved stock goes back on sale"), the confirm button repeats the verb, and the cancel button keeps things as they are ("Keep order"). For other dialogs, \`DialogContent\` is a bottom sheet on phones and centered on desktop.`,
    dts: `export interface ConfirmDialogProps {
  open: boolean; onOpenChange(open: boolean): void;
  title: React.ReactNode; body?: React.ReactNode;
  confirmLabel: string; cancelLabel: string;
  tone?: "danger" | "primary"; loading?: boolean;
  onConfirm(): void;
}`,
    preview: mount(`  const [o, setO] = React.useState(true);
  return h("div", null, h(A.Button, { variant: "secondary", onClick: function () { setO(true); } }, "Reject"),
    h(A.ConfirmDialog, { open: o, onOpenChange: setO, title: "Reject this order?", body: "The buyer will see it as rejected, and the reserved stock goes back on sale.", confirmLabel: "Reject", cancelLabel: "Keep order", onConfirm: function () { setO(false); } }));`),
  },
  {
    name: "Skeleton",
    group: "Feedback",
    height: 140,
    readme: `Skeleton holds the shape of content while it loads, on \`sunken\`. Match the real layout (a stat row, a card list) so nothing jumps when data arrives. It pulses only when motion is allowed.`,
    dts: `export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}`,
    preview: mount(`  return h("div", { className: "flex flex-col gap-2" }, h(A.Skeleton, { className: "h-6 w-48" }), h(A.Skeleton, { className: "h-4 w-72" }), h(A.Skeleton, { className: "h-16" }));`),
  },

  // ------------------------------------------------------------------ Stock & figures
  {
    name: "StockBar",
    group: "Stock & figures",
    height: 260,
    readme: `StockBar is AnnSetu's signature: one bar per listing, split into sold, reserved (in open orders) and unsold, plus spoiled when there is any.

Segments are told apart three ways, so the bar never relies on hue: lightness (\`chart-1\` dark, \`chart-2\` mid, \`stock-track\` light), 2px surface gaps between segments, and a named legend with quantities. Spoiled stock uses a 135° \`danger\` hatch. The bar is a single image to screen readers, with the full breakdown as its label.

**Provide** \`name\`, \`unit\` and the four quantities from the listing. \`size="md"\` shows the legend; \`sm\` shows a one-line summary ("62 of 100 kg sold") for rows. The fill grows in once on first view, unless reduced motion is on.`,
    dts: `export interface StockBarProps {
  name: string;
  unit: string;
  sold: number;
  reserved: number;
  available: number;
  spoiled?: number;
  size?: "sm" | "md";
  animate?: boolean;
}`,
    preview: mount(`  return h("div", { className: "flex flex-col gap-6" },
    h(A.StockBar, { name: "Tomato", unit: "kg", sold: 62, reserved: 14, available: 24 }),
    h(A.StockBar, { name: "Wheat", unit: "quintal", sold: 12, reserved: 4, available: 23, spoiled: 1 }),
    h(A.Lang, { lang: "hi" }, h(A.StockBar, { name: "टमाटर", unit: "kg", sold: 62, reserved: 14, available: 24, size: "sm" })));`),
  },
  {
    name: "StatCard",
    group: "Stock & figures",
    height: 170,
    readme: `StatCard is a dashboard figure: label, value, and a hint that says where the number comes from.

Values use the display face (\`kpi\` style: Anek 600, semi-condensed) with proportional figures; tabular figures are only for columns. Money is compact in Indian notation (₹1.2L). Set \`attention\` to add a \`haldi\` dot when the figure needs action, such as new orders waiting.`,
    dts: `export interface StatCardProps { label: string; value: string; hint?: string; icon?: React.ComponentType<{ className?: string }>; attention?: boolean }`,
    preview: mount(`  return h("div", { className: "grid grid-cols-2 gap-3" },
    h(A.StatCard, { label: "Earned", value: "₹1.2L", hint: "From delivered orders" }),
    h(A.StatCard, { label: "Orders to act on", value: "3", hint: "New: 1", attention: true }));`),
  },
  {
    name: "PriceTag",
    group: "Stock & figures",
    height: 90,
    readme: `PriceTag prints a price per unit: the amount leads in the display face, the unit follows quietly ("₹32/kg"). Amounts use Indian grouping (₹1,25,000). Every price on AnnSetu names its unit.`,
    dts: `export interface PriceTagProps { price: number; unit: string; size?: "sm" | "md" | "lg" }`,
    preview: mount(`  return h("div", { className: "flex flex-wrap items-baseline gap-6" }, h(A.PriceTag, { price: 32, unit: "kg", size: "sm" }), h(A.PriceTag, { price: 32, unit: "kg" }), h(A.PriceTag, { price: 2650, unit: "quintal", size: "lg" }));`),
  },
  {
    name: "LedgerEntry",
    group: "Stock & figures",
    height: 450,
    readme: `LedgerEntry is one line of a listing's stock log: what changed, when, by how much, and the order or note behind it.

The sign shows the effect on unsold stock: listed and restocked add, reserved and spoiled subtract, released adds back, and sold has no sign (it moves stock that was already reserved). Spoiled lines use \`danger\` on \`danger-soft\`, sold lines \`success\`.`,
    dts: `export interface LedgerEntryProps {
  entry: { id: string; change_type: "listed" | "restocked" | "reserved" | "released" | "sold" | "spoiled" | "adjusted"; quantity: number; note: string | null; order_id: string | null; created_at: string };
  unit: string;
}`,
    preview: mount(`  return h("ol", { className: "divide-y divide-border rounded-md border border-border bg-surface px-4" }, S.sampleLedger.map(function (e) { return h(A.LedgerEntry, { key: e.id, entry: e, unit: "kg" }); }));`),
  },
  {
    name: "Table",
    group: "Stock & figures",
    height: 180,
    readme: `Table is the plain-numbers view behind every chart, and the layout for dense lists on desktop. It scrolls sideways inside its own container; the page never does. Numeric cells are right-aligned with tabular figures; the header row sits on \`sunken\`.`,
    dts: `export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> { numeric?: boolean }`,
    preview: mount(`  return h(A.Table, null, h(A.THead, null, h(A.TR, null, h(A.TH, null, "Produce"), h(A.TH, { className: "text-right" }, "Sold"), h(A.TH, { className: "text-right" }, "Unsold"))),
    h(A.TBody, null, h(A.TR, null, h(A.TD, null, "Tomato"), h(A.TD, { numeric: true }, "62 kg"), h(A.TD, { numeric: true }, "24 kg")), h(A.TR, null, h(A.TD, null, "Wheat"), h(A.TD, { numeric: true }, "12 quintal"), h(A.TD, { numeric: true }, "23 quintal"))));`),
  },

  // ------------------------------------------------------------------ Market
  {
    name: "ProduceCard",
    group: "Market",
    height: 470,
    readme: `ProduceCard is one listing in the market grid, and the whole card is a single link to it.

It shows the photo (or the category icon on \`sunken\` when there is none), organic badge, name and variety, PriceTag, quantity available, and the farmer's name, district and rating. **Provide** a \`MarketListing\` and its \`href\`.`,
    dts: `export interface ProduceCardProps { listing: MarketListing; href: string }`,
    preview: mount(`  return h("div", { className: "grid max-w-xl grid-cols-2 gap-4" }, h(A.ProduceCard, { listing: S.sampleListing, href: "#" }),
    h(A.Lang, { lang: "hi" }, h(A.ProduceCard, { listing: Object.assign({}, S.sampleListing, { category: "grains", name: "गेहूँ", variety: "शरबती", unit: "quintal", price_per_unit: 2650, qty_available: 23, is_organic: false, farmer_name: "गुरप्रीत सिंह", district: "लुधियाना", farmer_rating: null }), href: "#" })));`),
  },
  {
    name: "ProduceRow",
    group: "Market",
    height: 220,
    readme: `ProduceRow is a farmer's own listing in "My produce": photo, status, price, a compact StockBar, "Update stock", and a menu for edit, stock log, pause and archive.

**Provide** the \`Produce\` row, \`editHref\`, \`logHref\`, and handlers. Archive goes through a ConfirmDialog.`,
    dts: `export interface ProduceRowProps { produce: Produce; editHref: string; logHref: string; onUpdateStock?(): void; onSetStatus?(s: "active" | "paused" | "archived"): void }`,
    preview: mount(`  return h(A.RoleScope, { role: "farmer" }, h(A.ProduceRow, { produce: S.sampleProduce, editHref: "#", logHref: "#", onUpdateStock: function () {}, onSetStatus: function () {} }));`),
  },
  {
    name: "FarmerCard",
    group: "Market",
    height: 190,
    readme: `FarmerCard says who grew it: avatar, name, farm, district and state, rating with count, and how long they've been on AnnSetu. It never shows a phone number or an exact location; buyers see the farmer's phone only on their own orders.`,
    dts: `export interface FarmerCardProps { farmer: FarmerPublic; href?: string }`,
    preview: mount(`  return h(A.FarmerCard, { farmer: S.sampleFarmer });`),
  },
  {
    name: "CartLine",
    group: "Market",
    height: 210,
    readme: `CartLine is one item in the cart: photo, name, price per unit, a QuantityStepper limited by the listing, the line total, and remove. It switches from stacked to one row when its container is wide enough.`,
    dts: `export interface CartLineProps { line: CartLine; onQuantity(q: number): void; onRemove(): void }`,
    preview: mount(`  return h("ul", { className: "divide-y divide-border rounded-md border border-border bg-surface px-4" }, S.sampleCart.map(function (l) { return h(A.CartLine, { key: l.produceId, line: l, onQuantity: function () {}, onRemove: function () {} }); }));`),
  },
  {
    name: "CartSummary",
    group: "Market",
    height: 390,
    readme: `CartSummary totals the cart per farmer and overall, and says plainly that a cart with items from N farmers becomes N separate orders. Payment is cash on delivery. **Provide** the cart \`lines\` and the checkout \`action\`.`,
    dts: `export interface CartSummaryProps { lines: CartLine[]; action?: React.ReactNode }`,
    preview: mount(`  return h(A.RoleScope, { role: "buyer" }, h("div", { className: "max-w-sm" }, h(A.CartSummary, { lines: S.sampleCart, action: h(A.Button, { size: "lg" }, "Place order") })));`),
  },

  // ------------------------------------------------------------------ Orders
  {
    name: "OrderStatusBadge",
    group: "Orders",
    height: 120,
    readme: `OrderStatusBadge names where an order is: New, Accepted, Packed, Out for delivery, Delivered, Rejected, Cancelled. Each pairs a tone with its own icon (Clock, CircleCheck, Package, Truck, PackageCheck, CircleX, Ban).`,
    dts: `export type OrderStatus = "placed" | "accepted" | "rejected" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
export interface OrderStatusBadgeProps { status: OrderStatus }`,
    preview: mount(`  return h("div", { className: "flex flex-wrap gap-2" }, ["placed", "accepted", "packed", "out_for_delivery", "delivered", "rejected", "cancelled"].map(function (s) { return h(A.OrderStatusBadge, { key: s, status: s }); }));`),
  },
  {
    name: "OrderTimeline",
    group: "Orders",
    height: 310,
    readme: `OrderTimeline is the order's journey as a vertical list, with the time of each step. Reached steps fill with \`role\`; a rejected order ends in \`danger\`, a cancelled one in neutral. It is an ordered list, with the current step marked for screen readers.`,
    dts: `export interface OrderTimelineProps { status: OrderStatus; history: { status: OrderStatus; at: string; by: "farmer" | "buyer" }[] }`,
    preview: mount(`  return h(A.RoleScope, { role: "buyer" }, h(A.OrderTimeline, { status: "out_for_delivery", history: S.sampleOrderInTransit.status_history }));`),
  },
  {
    name: "OrderCard",
    group: "Orders",
    height: 520,
    readme: `OrderCard is one order as either side sees it: the other party, items with line totals, the total and "Cash on delivery", the delivery address (farmer side) and the contact number, then the next step.

New orders get a \`haldi\` outline. The farmer's next step is the primary button (Accept, Mark packed, Send for delivery, Mark delivered); Reject and Cancel are secondary and confirm first. These buttons mirror exactly the moves the database allows.`,
    dts: `export interface OrderCardProps { order: Order; perspective: "farmer" | "buyer"; onAction?(s: OrderStatus): void; busyStatus?: OrderStatus | null; footer?: React.ReactNode }`,
    preview: mount(`  return h(A.RoleScope, { role: "farmer" }, h("div", { className: "max-w-md" }, h(A.OrderCard, { order: S.sampleOrder, perspective: "farmer", onAction: function () {} })));`),
  },

  // ------------------------------------------------------------------ Demand
  {
    name: "DemandCard",
    group: "Demand",
    height: 280,
    readme: `DemandCard shows a buyer's open requirement to farmers: item, quantity needed, needed-by date, target price, buyer type and place, with a "List this" shortcut that opens a prefilled listing form.

The buyer is labelled by first name or business name only. A one-line \`reason\` slot shows text from the recommendation logic when it provides one.`,
    dts: `export interface DemandCardProps { demand: OpenDemand; listHref?: string; reason?: string; compact?: boolean }`,
    preview: mount(`  return h(A.RoleScope, { role: "farmer" }, h(A.DemandCard, { demand: S.sampleDemand, listHref: "#" }));`),
  },
  {
    name: "SuggestionPanel",
    group: "Demand",
    height: 510,
    readme: `SuggestionPanel is the farmer's "In demand" panel. It renders whatever the recommendation hook returns (\`src/lib/recommend\`); by default that is open buyer requests, newest first, with no ranking.

**Provide** \`suggestions\` and \`listHref\` for each. The \`haldi\` dot marks the panel as the place for demand across the app.`,
    dts: `export interface Suggestion { id: string; kind: "demand"; demand?: OpenDemand; score?: number; reason?: string }
export interface SuggestionPanelProps { suggestions: Suggestion[]; listHref(s: Suggestion): string | undefined; seeAllHref?: string; limit?: number; loading?: boolean }`,
    preview: mount(`  return h(A.RoleScope, { role: "farmer" }, h(A.SuggestionPanel, { suggestions: [{ id: "a", kind: "demand", demand: S.sampleDemand }, { id: "b", kind: "demand", demand: Object.assign({}, S.sampleDemand, { id: "d2", item_name: "Green chilli", quantity: 40, buyer_type: "individual", buyer_label: "Sam", target_price: null }) }], listHref: function () { return "#"; } }));`),
  },

  // ------------------------------------------------------------------ Identity
  {
    name: "BrandMark",
    group: "Identity",
    height: 100,
    readme: `BrandMark is the AnnSetu wordmark: the name in Anek Devanagari 700 with its Devanagari twin, beside a bridge arc whose farm half is \`khet\` and buyer half \`neel\`, crowned by a \`haldi\` grain.

There is no official logo yet; this mark is a stand-in drawn for the project. Use \`compact\` in app headers.`,
    dts: `export interface BrandMarkProps { compact?: boolean; className?: string }`,
    preview: mount(`  return h("div", { className: "flex flex-wrap items-center gap-8" }, h(A.BrandMark), h(A.BrandMark, { compact: true }));`),
  },
  {
    name: "CategoryIcon",
    group: "Identity",
    height: 120,
    readme: `CategoryIcon draws the lucide icon for a produce category: Carrot (vegetables), Apple (fruits), Wheat (grains), Bean (pulses), Flame (spices), Milk (dairy), Droplet (oilseeds), Sprout (others). Use it on chips, on demand cards, and as the photo stand-in.`,
    dts: `export interface CategoryIconProps { category: CategorySlug; className?: string }`,
    preview: mount(`  return h("div", { className: "flex flex-wrap gap-4" }, ["vegetables", "fruits", "grains", "pulses", "spices", "dairy", "oilseeds", "others"].map(function (c) { return h("span", { key: c, className: "flex size-12 items-center justify-center rounded-full bg-sunken" }, h(A.CategoryIcon, { category: c, className: "size-6 text-ink-muted" })); }));`),
  },
  {
    name: "Avatar",
    group: "Identity",
    height: 90,
    readme: `Avatar shows a profile photo, or the person's initials in the display face on \`role-soft\` when there is none.`,
    dts: `export interface AvatarProps { src?: string | null; name: string; size?: number }`,
    preview: mount(`  return h("div", { className: "flex items-center gap-3" }, h(A.Avatar, { name: "Ramesh Patil", size: 56 }), h(A.RoleScope, { role: "buyer" }, h(A.Avatar, { name: "Anita Rao", size: 40 })));`),
  },
  {
    name: "Card",
    group: "Identity",
    height: 230,
    readme: `Card sets one object apart: \`surface\` fill, hairline \`border\`, \`radius-md\`, no shadow at rest. Use it by role (a form, a chart, a summary), not around every block. CardHeader, CardTitle (h3 style), CardDescription and CardContent keep the padding consistent: 16px on phones, 24px from sm.`,
    dts: `export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}`,
    preview: mount(`  return h(A.Card, null, h(A.CardHeader, null, h(A.CardTitle, null, "Earnings by week"), h(A.CardDescription, null, "Last 8 weeks, delivered orders")), h(A.CardContent, null, h(A.Skeleton, { className: "h-20" })));`),
  },
];
