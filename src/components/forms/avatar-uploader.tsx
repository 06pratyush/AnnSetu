"use client";

import { useId, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateProfile, uploadPhoto } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { Avatar } from "@/components/ui/controls";
import { toast } from "@/components/ui/toaster";
import { compressPhoto } from "@/components/domain/photo-uploader";
import { cn } from "@/lib/utils";

export function AvatarUploader() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const id = useId();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  async function onFile(file: File | undefined) {
    if (!file || !profile) return;
    setBusy(true);
    try {
      const small = await compressPhoto(file);
      const url = await uploadPhoto("avatars", profile.id, small);
      await updateProfile(profile.id, { avatar_url: url });
      await refreshProfile();
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={profile.avatar_url} name={profile.full_name || "?"} size={72} />
      <label
        htmlFor={id}
        className={cn(
          "inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-body font-semibold text-ink hover:bg-sunken",
          "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <Camera className="size-5" aria-hidden />
        {t("profile.changePhoto")}
        <input id={id} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}
