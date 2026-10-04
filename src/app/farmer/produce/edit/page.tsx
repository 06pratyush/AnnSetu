"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { updateProduce } from "@/lib/api";
import { keys, useProduce } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/domain/empty-state";
import { ProduceForm } from "@/components/forms/produce-form";

function EditProduce() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const id = useSearchParams().get("id");
  const produce = useProduce(id);
  if (produce.isLoading) return <PageSkeleton />;
  if (!produce.data || produce.data.farmer_id !== profile?.id) return <EmptyState icon={SearchX} title={t("produce.notFound")} />;
  const p = produce.data;
  return (
    <>
      <PageHeader title={t("produce.editTitle")} subtitle={p.name} />
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <ProduceForm
            initial={p}
            submitLabel={t("produce.save")}
            onSubmit={async ({ qty_listed: _qty, ...patch }) => {
              void _qty;
              await updateProduce(p.id, patch);
              toast.success(t("produce.updated"));
              await Promise.all([
                qc.invalidateQueries({ queryKey: keys.myProduce(profile?.id) }),
                qc.invalidateQueries({ queryKey: keys.produce(p.id) }),
              ]);
              router.push("/farmer/produce");
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function EditProducePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditProduce />
    </Suspense>
  );
}
