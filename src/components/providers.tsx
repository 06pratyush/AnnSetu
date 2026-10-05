"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { LanguageProvider } from "@/lib/i18n/provider";
import { Toaster } from "@/components/ui/toaster";
import { DemoBanner } from "@/components/layout/demo-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DemoBanner />
          {children}
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
