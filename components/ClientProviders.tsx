'use client';

import { ThemeProvider } from "@/components/ui/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </ThemeProvider>
  );
}