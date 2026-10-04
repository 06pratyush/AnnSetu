"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { createProduce } from "@/lib/api";
import { keys, useOpenDemand } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { ProduceForm } from "@/components/forms/produce-form";

function NewProduce() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { profile } = useAuth();
  const demandId = params.get("demand");
  const demand = useOpenDemand();
  const fromDemand = demandId ? demand.data?.find((d) => d.id === demandId) : undefined;
  if (demandId && demand.isLoading) return <PageSkeleton />;

  return (
    <>
      <PageHeader title={t("produce.newTitle")} />
      {fromDemand ? (
        <Alert tone="accent" className="mb-4">
          {t("produce.fromDemand", { item: fromDemand.item_name })}
        </Alert>
      ) : null}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <ProduceForm
            draft={fromDemand ? { name: fromDemand.item_name, category: fromDemand.category, unit: fromDemand.unit } : undefined}
            submitLabel={t("produce.create")}
            onSubmit={async (input) => {
              await createProduce(input);
              toast.success(t("produce.created"));
              await qc.invalidateQueries({ queryKey: keys.myProduce(profile?.id) });
              router.push("/farmer/produce");
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function NewProducePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProduce />
    </Suspense>
  );
}
