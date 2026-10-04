"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCurrentPosition, reverseGeocode, type GeoError, type LatLng } from "@/lib/geo";
import { useLang } from "@/lib/i18n/provider";
import type { AddressInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full rounded-md" />,
});

export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

export const EMPTY_ADDRESS: AddressInput = {
  label: "home",
  line1: "",
  line2: "",
  village_city: "",
  district: "",
  state: "",
  pincode: "",
  lat: null,
  lng: null,
};

/**
 * GPS button + draggable map pin + editable address fields.
 * "Use my location" fills the pin, then OpenStreetMap prefills the address; every field stays editable.
 */
export function LocationPicker({
  value,
  onChange,
  errors,
  idPrefix = "addr",
  showMap = true,
}: {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors?: AddressErrors;
  idPrefix?: string;
  showMap?: boolean;
}) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const point: LatLng | null = value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null;

  const fillFrom = useCallback(
    async (p: LatLng, base: AddressInput) => {
      try {
        const found = await reverseGeocode(p, lang);
        const merged: AddressInput = { ...base, lat: p.lat, lng: p.lng };
        (Object.keys(found) as (keyof AddressInput)[]).forEach((k) => {
          const v = found[k];
          if (v !== undefined && v !== null && v !== "") (merged as Record<string, unknown>)[k] = v;
        });
        onChange(merged);
        setMessage({ tone: "success", text: t("location.filled") });
      } catch {
        onChange({ ...base, lat: p.lat, lng: p.lng });
        setMessage({ tone: "warning", text: t("location.lookupFailed") });
      }
    },
    [lang, onChange, t],
  );

  async function locateMe() {
    setLocating(true);
    setMessage(null);
    try {
      const pos = await getCurrentPosition();
      setAccuracy(pos.accuracy);
      await fillFrom({ lat: pos.lat, lng: pos.lng }, value);
    } catch (e) {
      const err = e as GeoError;
      setMessage({ tone: "danger", text: err === "denied" ? t("location.gpsDenied") : t("location.gpsUnavailable") });
    } finally {
      setLocating(false);
    }
  }

  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="button" variant="secondary" onClick={locateMe} loading={locating} className="sm:self-start">
          {locating ? null : <LocateFixed aria-hidden />}
          {locating ? t("location.locating") : t("location.useGps")}
        </Button>
        <p className="flex items-center gap-1.5 text-small text-ink-muted" aria-live="polite">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {point
            ? `${t("location.pinSet", { lat: point.lat.toFixed(5), lng: point.lng.toFixed(5) })}${accuracy ? ` · ${t("location.accuracy", { meters: accuracy })}` : ""}`
            : t("location.noPin")}
        </p>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {showMap ? (
        <div className="flex flex-col gap-1.5">
          <LeafletMap
            point={point}
            label={t("location.mapLabel")}
            onPick={(p) => {
              setAccuracy(null);
              void fillFrom(p, value);
            }}
          />
          <p className="text-small text-ink-muted">{t("location.dragPin")}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("line1")} label={t("location.line1")} error={errors?.line1} className="sm:col-span-2">
          <Input value={value.line1} onChange={set("line1")} autoComplete="address-line1" />
        </Field>
        <Field id={id("line2")} label={t("location.line2")} optional={t("common.optional")} className="sm:col-span-2">
          <Input value={value.line2 ?? ""} onChange={set("line2")} autoComplete="address-line2" />
        </Field>
        <Field id={id("village")} label={t("location.village")} error={errors?.village_city}>
          <Input value={value.village_city} onChange={set("village_city")} autoComplete="address-level2" />
        </Field>
        <Field id={id("district")} label={t("location.district")} error={errors?.district}>
          <Input value={value.district} onChange={set("district")} />
        </Field>
        <Field id={id("state")} label={t("location.state")} error={errors?.state}>
          <Input value={value.state} onChange={set("state")} autoComplete="address-level1" />
        </Field>
        <Field id={id("pincode")} label={t("location.pincode")} error={errors?.pincode}>
          <Input value={value.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
        </Field>
      </div>
    </div>
  );
}

/** Validates the address fields; returns translated errors keyed by field. */
export function validateAddress(a: AddressInput, t: (k: string) => string): AddressErrors {
  const e: AddressErrors = {};
  if (!a.line1.trim()) e.line1 = t("errors.required");
  if (!a.village_city.trim()) e.village_city = t("errors.required");
  if (!a.district.trim()) e.district = t("errors.required");
  if (!a.state.trim()) e.state = t("errors.required");
  if (!/^\d{6}$/.test(a.pincode.trim())) e.pincode = t("errors.pincode");
  return e;
}

/** Read-only map of a saved point. */
export function MapPreview({ point, label, height = 200 }: { point: LatLng; label: string; height?: number }) {
  return <LeafletMap point={point} label={label} height={height} />;
}
