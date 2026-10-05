"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Building2, ClipboardList, Package, Radio, Store, Tractor, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/domain/brand";
import { LanguageToggle } from "@/components/domain/choices";
import { StockBar } from "@/components/domain/stock-bar";
import { PriceTag } from "@/components/domain/figures";
import { OrderStatusBadge } from "@/components/domain/orders";

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-role-soft">
        <Icon className="size-5 text-role" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-display text-h3 font-semibold text-ink">{title}</h3>
        <p className="text-body text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

/** The hero's right side: what each half of the bridge actually looks like, with example data. */
function BridgePreview() {
  const { t } = useTranslation();
  return (
    <div className="relative flex flex-col gap-4" aria-label={t("common.example")}>
      <div data-role="farmer" className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-small font-semibold text-ink-muted">
            <Tractor className="size-4 text-role" aria-hidden />
            {t("nav.farmerArea")} · {t("produce.log")}
          </p>
          <span className="rounded-sm bg-sunken px-2 py-0.5 text-label text-ink-muted">{t("common.example")}</span>
        </div>
        <p className="mb-2 font-display text-h3 font-semibold text-ink">
          Tomato <span className="font-body text-body font-normal text-ink-muted">· Desi</span>
        </p>
        <StockBar name="Tomato" unit="kg" sold={62} reserved={14} available={24} />
      </div>
      <div data-role="buyer" className="rounded-lg border border-border bg-surface p-5 shadow-card sm:ml-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-small font-semibold text-ink-muted">
            <Store className="size-4 text-role" aria-hidden />
            {t("nav.buyerArea")} · {t("nav.myOrders")}
          </p>
          <OrderStatusBadge status="out_for_delivery" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-h3 font-semibold text-ink">Onion · 25 kg</p>
            <p className="text-small text-ink-muted">Ramesh Patil · Junnar, Pune</p>
          </div>
          <PriceTag price={24} unit="kg" />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const signedIn = Boolean(session && profile);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <BrandMark />
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            {signedIn ? (
              <Button asChild size="sm">
                <Link href={homeFor(profile)}>
                  {t("errors.goToMyHome")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href="/login">{t("common.signIn")}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-label-caps text-small font-semibold text-haldi-ink">{t("landing.eyebrow")}</p>
            <h1 className="font-display text-display font-bold text-ink sm:text-[3.25rem] sm:leading-[1.05]">{t("landing.title")}</h1>
            <p className="max-w-xl text-body-lg text-ink-muted">{t("landing.body")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <span data-role="farmer" className="contents">
                <Button asChild size="lg">
                  <Link href="/signup?as=farmer">
                    <Tractor aria-hidden />
                    {t("landing.ctaFarmer")}
                  </Link>
                </Button>
              </span>
              <span data-role="buyer" className="contents">
                <Button asChild size="lg">
                  <Link href="/signup?as=individual">
                    <Store aria-hidden />
                    {t("landing.ctaBuyer")}
                  </Link>
                </Button>
              </span>
            </div>
            <Link href="/market" className="inline-flex items-center gap-2 self-start text-body font-semibold text-ink underline-offset-4 hover:underline">
              {t("landing.browse")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <BridgePreview />
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:py-16 md:grid-cols-2">
            <div data-role="farmer" className="flex flex-col gap-6">
              <h2 className="flex items-center gap-3 font-display text-h2 font-bold text-ink">
                <span className="h-1 w-8 rounded-full bg-role" aria-hidden />
                {t("landing.forFarmers")}
              </h2>
              <ul className="flex flex-col gap-6">
                <Feature icon={ClipboardList} title={t("landing.farmer1Title")} body={t("landing.farmer1Body")} />
                <Feature icon={TrendingUp} title={t("landing.farmer2Title")} body={t("landing.farmer2Body")} />
                <Feature icon={Radio} title={t("landing.farmer3Title")} body={t("landing.farmer3Body")} />
              </ul>
            </div>
            <div data-role="buyer" className="flex flex-col gap-6">
              <h2 className="flex items-center gap-3 font-display text-h2 font-bold text-ink">
                <span className="h-1 w-8 rounded-full bg-role" aria-hidden />
                {t("landing.forBuyers")}
              </h2>
              <ul className="flex flex-col gap-6">
                <Feature icon={Package} title={t("landing.buyer1Title")} body={t("landing.buyer1Body")} />
                <Feature icon={Building2} title={t("landing.buyer2Title")} body={t("landing.buyer2Body")} />
                <Feature icon={Banknote} title={t("landing.buyer3Title")} body={t("landing.buyer3Body")} />
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl justify-end px-4 py-6 text-small">
          <Link href="/design-system" className="font-semibold text-ink underline-offset-4 hover:underline">
            {t("nav.designSystem")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
