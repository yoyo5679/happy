"use client";

import { useEffect } from "react";
import { rememberSource } from "@/lib/utm";

export function SourceTracker() {
  useEffect(rememberSource, []);
  return null;
}
