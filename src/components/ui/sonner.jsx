"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Thin wrapper around sonner's Toaster so it picks up our design-system
 * tokens (see globals.css) instead of sonner's defaults. Mounted once
 * in the root layout — call `toast()` (from "sonner") anywhere else.
 */
function Toaster({ ...props }) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-border bg-card text-card-foreground shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
