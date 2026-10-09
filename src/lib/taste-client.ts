"use client";

import { applySignal, emptyTaste, parseTaste, type TasteProfile, type TasteSignal } from "./taste";
import type { Activity } from "./types";

const KEY = "giro.taste.v1";
let memory: TasteProfile | undefined;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

export function loadTaste(): TasteProfile {
  if (memory) return memory;
  try {
    memory = parseTaste(JSON.parse(localStorage.getItem(KEY) ?? "null")) ?? emptyTaste();
  } catch {
    memory = emptyTaste();
  }
  return memory;
}

export function saveTaste(profile: TasteProfile, { sync = true } = {}) {
  memory = profile;
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
  if (sync) scheduleSync(profile);
}

/** Record what the traveller did; quietly synced to their account when signed in. */
export function recordSignal(signal: TasteSignal, category: Activity["category"]) {
  saveTaste(applySignal(loadTaste(), signal, category));
}

function scheduleSync(profile: TasteProfile) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    // 401 simply means "not signed in"; the profile stays in this browser.
    fetch("/api/me/taste", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) }).catch(() => {});
  }, 1500);
}
