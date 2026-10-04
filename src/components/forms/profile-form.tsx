"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, type FullProfile } from "@/lib/auth/auth-provider";
import { saveBuyerDetails, saveDefaultAddress, saveFarmerDetails, updateProfile } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Address, AddressInput, BusinessType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChipInput } from "@/components/ui/chip-input";
import { Field, FieldSet } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Separator } from "@/components/ui/misc";
import { EMPTY_ADDRESS, LocationPicker, validateAddress, type AddressErrors } from "@/components/map/location-picker";

const BUSINESS_TYPES: BusinessType[] = ["restaurant", "retailer", "wholesaler", "processor", "institution", "other"];

/**
 * The full profile form used by onboarding (first run) and the profile pages (edits):
 * about you, the role's own section, and the location picker.
 */
export function ProfileForm({
  profile,
  address,
  submitLabel,
  onSaved,
  insideShell = false,
}: {
  profile: FullProfile;
  address: Address | null;
  submitLabel: string;
  onSaved: () => void;
  /** Inside the app shell the sticky save bar sits above the phone's bottom tab bar. */
  insideShell?: boolean;
}) {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const isFarmer = profile.role === "farmer";
  const isIndustrial = profile.consumer_type === "industrial";

  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [farmName, setFarmName] = useState(profile.farmer_details?.farm_name ?? "");
  const [farmSize, setFarmSize] = useState(profile.farmer_details?.farm_size_acres?.toString() ?? "");
  const [crops, setCrops] = useState<string[]>(profile.farmer_details?.main_crops ?? []);
  const [businessName, setBusinessName] = useState(profile.buyer_details?.business_name ?? "");
  const [businessType, setBusinessType] = useState<BusinessType | "">(profile.buyer_details?.business_type ?? "");
  const [gstin, setGstin] = useState(profile.buyer_details?.gstin ?? "");
  const [addr, setAddr] = useState<AddressInput>(
    address
      ? { label: address.label, line1: address.line1, line2: address.line2 ?? "", village_city: address.village_city, district: address.district, state: address.state, pincode: address.pincode, lat: address.lat, lng: address.lng }
      : { ...EMPTY_ADDRESS, label: isFarmer ? "farm" : isIndustrial ? "work" : "home" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("errors.required");
    const digits = phone.replace(/\D/g, "");
    if (!/^(91)?[6-9]\d{9}$/.test(digits)) next.phone = t("errors.phone");
    if (isFarmer && farmSize && (Number.isNaN(Number(farmSize)) || Number(farmSize) < 0)) next.farmSize = t("errors.positive");
    if (isIndustrial && !businessName.trim()) next.businessName = t("errors.required");
    if (isIndustrial && gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin.trim().toUpperCase())) next.gstin = t("errors.gstin");
    const ae = validateAddress(addr, t);
    setErrors(next);
    setAddrErrors(ae);
    setFormError(null);
    if (Object.keys(next).length || Object.keys(ae).length) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    setBusy(true);
    try {
      if (isFarmer) {
        await saveFarmerDetails(profile.id, {
          farm_name: farmName.trim() || null,
          farm_size_acres: farmSize ? Number(farmSize) : null,
          main_crops: crops,
        });
      } else {
        await saveBuyerDetails(profile.id, {
          business_name: businessName.trim() || null,
          business_type: businessType || null,
          gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        });
      }
      await saveDefaultAddress(profile.id, addr);
      await updateProfile(profile.id, { full_name: name.trim(), phone: digits.slice(-10), onboarded: true });
      await refreshProfile();
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <FieldSet legend={t("onboarding.about")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="full-name" label={t("auth.fullName")} error={errors.name}>
            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="phone" label={t("common.phone")} hint={isFarmer ? t("onboarding.phoneFarmerHint") : t("onboarding.phoneBuyerHint")} error={errors.phone}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
          </Field>
        </div>
      </FieldSet>

      <Separator />

      {isFarmer ? (
        <FieldSet legend={t("onboarding.farm")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="farm-name" label={t("onboarding.farmName")} optional={t("common.optional")}>
              <Input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder={t("onboarding.farmNamePlaceholder")} />
            </Field>
            <Field id="farm-size" label={t("onboarding.farmSize")} optional={t("common.optional")} error={errors.farmSize}>
              <Input type="number" inputMode="decimal" min={0} step="any" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} />
            </Field>
            <Field id="crops" label={t("onboarding.mainCrops")} hint={t("onboarding.mainCropsHint")} className="sm:col-span-2">
              <ChipInput value={crops} onChange={setCrops} removeLabel={(c) => `${t("common.remove")}: ${c}`} />
            </Field>
          </div>
        </FieldSet>
      ) : isIndustrial ? (
        <FieldSet legend={t("onboarding.business")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="business-name" label={t("onboarding.businessName")} error={errors.businessName}>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" />
            </Field>
            <Field id="business-type" label={t("onboarding.businessType")} optional={t("common.optional")}>
              <NativeSelect value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType | "")}>
                <option value="">—</option>
                {BUSINESS_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {t(`onboarding.businessTypes.${b}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="gstin" label={t("onboarding.gstin")} optional={t("common.optional")} hint={t("onboarding.gstinHint")} error={errors.gstin}>
              <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} autoCapitalize="characters" />
            </Field>
          </div>
        </FieldSet>
      ) : null}

      {isFarmer || isIndustrial ? <Separator /> : null}

      <FieldSet legend={t("onboarding.location")} description={isFarmer ? t("onboarding.locationFarmerHint") : t("onboarding.locationBuyerHint")}>
        <LocationPicker value={addr} onChange={setAddr} errors={addrErrors} />
      </FieldSet>

      <div
        className={cn(
          "sticky z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
          insideShell ? "bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)]" : "bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]",
        )}
      >
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          {busy ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
