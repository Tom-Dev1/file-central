import { useEffect, useRef } from "react";
import { useIsFetching } from "@tanstack/react-query";
import NProgress from "nprogress";
import { driveKeys } from "@/lib/query-keys";

const START_DELAY = 150;

NProgress.configure({
  minimum: 0.12,
  showSpinner: false,
  trickle: true,
  trickleSpeed: 120,
  easing: "ease",
  speed: 250,
});

export function DriveNProgress() {
  const fetchingCount = useIsFetching({
    queryKey: driveKeys.all,
    type: "active",
    predicate: (query) => query.meta?.suppressGlobalProgress !== true,
  });

  const startTimerRef = useRef<number | null>(null);

  const isProgressVisibleRef = useRef(false);

  useEffect(() => {
    if (fetchingCount > 0) {
      if (isProgressVisibleRef.current || startTimerRef.current !== null) {
        return;
      }

      /*
       * Delay the progress bar slightly so fast cached requests
       * do not cause a visible flash.
       */
      startTimerRef.current = window.setTimeout(() => {
        NProgress.start();

        isProgressVisibleRef.current = true;

        startTimerRef.current = null;
      }, START_DELAY);

      return;
    }

    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);

      startTimerRef.current = null;
    }

    if (isProgressVisibleRef.current) {
      NProgress.done();

      isProgressVisibleRef.current = false;
    }
  }, [fetchingCount]);

  useEffect(() => {
    return () => {
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
      }

      NProgress.done(true);
    };
  }, []);

  return null;
}
