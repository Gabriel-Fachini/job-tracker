"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { config, useSpring } from "@react-spring/web";

/**
 * Measures the active item inside `containerRef` and returns spring values
 * for a single shared indicator that slides under nav items on route change,
 * instead of the active state just popping from one item to the next.
 */
export function useNavIndicator(activeKey: string) {
  // State (not a plain ref) so the mobile sidebar's Sheet branch swapping
  // this element out from under us — e.g. crossing the md breakpoint —
  // re-runs the effect below instead of leaving a stale observer attached
  // to a removed node.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  // First measurement snaps into place; every one after that slides.
  const hasMeasuredOnce = useRef(false);

  const [style, api] = useSpring(() => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    opacity: 0,
    config: config.stiff,
  }));

  const measure = useCallback(() => {
    const activeEl = itemRefs.current.get(activeKey);

    if (!container || !activeEl) {
      api.start({ opacity: 0 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    api.start({
      x: activeRect.left - containerRect.left,
      y: activeRect.top - containerRect.top,
      width: activeRect.width,
      height: activeRect.height,
      opacity: 1,
      immediate: !hasMeasuredOnce.current,
    });

    hasMeasuredOnce.current = true;
  }, [activeKey, container, api]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!container) return undefined;

    // Sidebar collapse/expand and viewport resizes both change item geometry.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [container, measure]);

  const registerItem = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(key, el);
      else itemRefs.current.delete(key);
    },
    [],
  );

  return { containerRef: setContainer, registerItem, style };
}
