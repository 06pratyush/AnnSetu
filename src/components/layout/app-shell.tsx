"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  ShoppingCart,
  Store,
  TrendingUp,
  User,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/cart";
import { updateProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/controls";
import { BrandMark } from "@/components/domain/brand";
import { LanguageToggle, ThemeToggle } from "@/components/domain/choices";

export type ShellRole = "farmer" | "buyer";
type NavItem = { href: string; labelKey: string; icon: LucideIcon; exact?: boolean; badge?: number };

function useNav(role: ShellRole, pendingOrders: number): NavItem[] {
  const cartCount = useCart().length;
  if (role === "farmer") {
    return [
      { href: "/farmer", labelKey: "nav.home", icon: LayoutDashboard, exact: true },
      { href: "/farmer/produce", labelKey: "nav.produce", icon: Wheat },
      { href: "/farmer/orders", labelKey: "nav.orders", icon: ClipboardList, badge: pendingOrders },
      { href: "/farmer/suggestions", labelKey: "nav.demand", icon: TrendingUp },
      { href: "/farmer/profile", labelKey: "nav.profile", icon: User },
    ];
  }
  return [
    { href: "/market", labelKey: "nav.market", icon: Store },
    { href: "/requirements", labelKey: "nav.requirements", icon: ClipboardList },
    { href: "/cart", labelKey: "nav.cart", icon: ShoppingCart, badge: cartCount },
    { href: "/orders", labelKey: "nav.myOrders", icon: Package },
    { href: "/profile", labelKey: "nav.profile", icon: User },
  ];
}

function isActive(pathname: string, item: NavItem) {
  const p = pathname.replace(/\/$/, "") || "/";
  return item.exact ? p === item.href : p === item.href || p.startsWith(`${item.href}/`);
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex min-w-5 items-center justify-center rounded-full bg-haldi px-1.5 text-label font-bold text-on-haldi tabular-nums", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const accountType = profile.role === "farmer" ? t("roles.farmer") : t(`roles.${profile.consumer_type ?? "individual"}`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex size-12 items-center justify-center rounded-full hover:bg-sunken" aria-label={`${t("common.menu")}: ${profile.full_name}`}>
          <Avatar src={profile.avatar_url} name={profile.full_name || "?"} size={36} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-body font-semibold text-ink">{profile.full_name}</span>
          <span>{accountType}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-small text-ink-muted">{t("common.theme")}</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profile.role === "farmer" ? "/farmer/profile" : "/profile"}>
            <User aria-hidden />
            {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/design-system">
            <Palette aria-hidden />
            {t("nav.designSystem")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.replace("/");
          }}
        >
          <LogOut aria-hidden />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Role-colored chrome. Phones: top bar + bottom tab bar (thumb reach). Desktop: farmers get a
 * left sidebar, buyers a top navigation bar. data-role switches every --role token below it.
 */
export function AppShell({ role, children, pendingOrders = 0 }: { role: ShellRole; children: React.ReactNode; pendingOrders?: number }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { session, profile } = useAuth();
  const nav = useNav(role, pendingOrders);
  const signedIn = Boolean(session && profile);
  const showNav = role === "farmer" || signedIn;
  const homeHref = role === "farmer" ? "/farmer" : signedIn ? "/market" : "/";

  async function persistLang(l: "en" | "hi") {
    if (profile) await updateProfile(profile.id, { preferred_lang: l }).catch(() => undefined);
  }

  return (
    <div data-role={role} className="flex min-h-dvh flex-col bg-bg">
      <a href="#main" className="sr-only z-[60] rounded-md bg-surface px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t("common.skipToContent")}
      </a>

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4", role === "farmer" ? "lg:pl-72" : "max-w-6xl")}>
          <Link href={homeHref} className="rounded-sm" aria-label="AnnSetu">
            <BrandMark compact />
          </Link>
          <span className="hidden rounded-full bg-role-soft px-2.5 py-1 text-label font-semibold text-ink sm:inline">
            {t(role === "farmer" ? "nav.farmerArea" : "nav.buyerArea")}
          </span>

          {role === "buyer" && showNav ? (
            <nav aria-label={t("common.menu")} className="ml-4 hidden items-center gap-1 lg:flex">
              {nav.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-md px-3 text-body font-semibold",
                      active ? "bg-role-soft text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <item.icon className="size-5" aria-hidden />
                    {t(item.labelKey)}
                    <CountBadge count={item.badge ?? 0} />
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle onChange={persistLang} />
            {signedIn ? (
              <UserMenu />
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">{t("common.signIn")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">{t("common.signUp")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {role === "farmer" ? (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface pt-20 lg:block">
          <nav aria-label={t("common.menu")} className="flex flex-col gap-1 px-3">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 text-body font-semibold",
                    active ? "bg-role-soft text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  <item.icon className={cn("size-5", active && "text-role")} aria-hidden />
                  {t(item.labelKey)}
                  <CountBadge count={item.badge ?? 0} className="ml-auto" />
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <main
        id="main"
        className={cn("mx-auto w-full flex-1 px-4 py-6 sm:py-8", role === "farmer" ? "max-w-6xl lg:pl-72" : "max-w-6xl", showNav && "pb-28 lg:pb-10")}
      >
        {children}
      </main>

      {showNav ? (
        <nav
          aria-label={t("common.menu")}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] leading-tight font-semibold"
                  >
                    <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full", active ? "bg-role-soft text-ink" : "text-ink-muted")}>
                      <item.icon className={cn("size-5", active && "text-role")} aria-hidden />
                      {item.badge ? <CountBadge count={item.badge} className="absolute -top-1 -right-0.5" /> : null}
                    </span>
                    <span className={cn("max-w-full truncate px-0.5", active ? "text-ink" : "text-ink-muted")}>{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-display text-h1 font-bold text-ink sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-body text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
