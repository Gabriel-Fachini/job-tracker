"use client";

import { useEffect } from "react";
import { Globals, useReducedMotion } from "@react-spring/web";

/** Mounted once at the app shell: react-spring animations jump straight to
 * their end state for anyone who asked the OS for reduced motion. */
export function MotionPreferences() {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    Globals.assign({ skipAnimation: Boolean(prefersReducedMotion) });
  }, [prefersReducedMotion]);

  return null;
}
