// Entry for the design-system bundle: the app's real components, exposed as window.AnnSetu
// for the live previews in the AnnSetu Design System artifact. Built by scripts/ds/build-bundle.mjs.
import "@/lib/i18n";
import i18n from "i18next";
import { useMemo } from "react";
import { I18nextProvider } from "react-i18next";

export { Button } from "@/components/ui/button";
export { Badge } from "@/components/ui/badge";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
export { Field, FieldSet, Label } from "@/components/ui/field";
export { Input, NativeSelect, Textarea, UnitInput } from "@/components/ui/input";
export { Checkbox, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Avatar } from "@/components/ui/controls";
export { Dialog, DialogContent, ConfirmDialog } from "@/components/ui/dialog";
export { Alert, Skeleton, Spinner, Progress, Separator } from "@/components/ui/misc";
export { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
export { ChipInput } from "@/components/ui/chip-input";

export { BrandMark, BridgeArc, CategoryIcon, ProducePhoto } from "@/components/domain/brand";
export { StockBar } from "@/components/domain/stock-bar";
export { StatCard, PriceTag, QuantityStepper, UnitSelect } from "@/components/domain/figures";
export { ProduceCard, ProduceRow, LedgerEntry, ProduceStatusBadge, OrganicBadge } from "@/components/domain/produce";
export { OrderStatusBadge, OrderTimeline, OrderCard } from "@/components/domain/orders";
export { DemandCard, SuggestionPanel, TopRequested } from "@/components/domain/demand";
export { ItemPicker } from "@/components/domain/item-picker";
export { MatchCard, HiddenNote, BatchProgress, TrustLine, FreshLine, ScoreBreakdown } from "@/components/domain/matching";
export { SEED_CATALOGUE } from "@/lib/matching/catalogue-data";
export { indexCatalogue } from "@/lib/matching/search";
export { DEFAULT_SETTINGS } from "@/lib/matching/settings";
export { CategoryChips, SearchFilterBar, FarmerCard, RatingStars } from "@/components/domain/market";
export { CartLine, CartSummary } from "@/components/domain/cart";
export { RoleChoiceCards, LanguageToggle, ThemeToggle } from "@/components/domain/choices";
export { EmptyState } from "@/components/domain/empty-state";
export { PhotoUploader } from "@/components/domain/photo-uploader";

export * as samples from "@/components/design-system/samples";

/** Renders its children in another UI language (en | hi) without touching the rest of the page. */
export function Lang({ lang, children }: { lang: "en" | "hi"; children: React.ReactNode }) {
  const instance = useMemo(() => i18n.cloneInstance({ lng: lang }), [lang]);
  return (
    <I18nextProvider i18n={instance}>
      <div lang={lang}>{children}</div>
    </I18nextProvider>
  );
}

/** Wraps children in a role scope so the --role tokens follow the farmer (khet) or buyer (neel) side. */
export function RoleScope({ role, children }: { role: "farmer" | "buyer"; children: React.ReactNode }) {
  return <div data-role={role}>{children}</div>;
}
