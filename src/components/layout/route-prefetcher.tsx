"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREFETCH_ROUTES = [
  "/dashboard",
  "/today",
  "/add",
  "/ai",
  "/inbox",
  "/assignments",
  "/calendar",
  "/settings"
];

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const prefetchRoutes = () => {
      PREFETCH_ROUTES.forEach((route) => {
        router.prefetch(route);
      });
    };

    const win = window as WindowWithIdleCallback;

    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(prefetchRoutes, { timeout: 1800 });
      return () => win.cancelIdleCallback?.(handle);
    }

    const timeout = window.setTimeout(prefetchRoutes, 900);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return null;
}
