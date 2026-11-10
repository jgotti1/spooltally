"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./ScreenshotShowcase.module.css";

/**
 * Real captures of the app (sample shop data), stored in /public/screens at 2× resolution.
 * Each one is a whole screen, so the viewer scrolls through it instead of cropping it; the
 * `-thumb` files are the top of the same capture, downsized for the picker.
 */
const screens = [
  {
    id: "project",
    label: "Project details",
    caption: "Costs and suggested prices",
    src: "/screens/project-detail.webp",
    thumb: "/screens/project-detail-thumb.webp",
    width: 1440,
    height: 5176,
    alt: "SpoolTally project details for a hex planter batch: status, nozzle size, two filament colors linked to inventory rolls, print time, units per batch, a full cost breakdown, and a suggested sale price for each sales channel.",
  },
  {
    id: "inventory",
    label: "Filament inventory",
    caption: "Roll levels and reorder report",
    src: "/screens/inventory.webp",
    thumb: "/screens/inventory-thumb.webp",
    width: 1440,
    height: 4206,
    alt: "SpoolTally filament inventory: a reorder report flagging rolls to reorder now or soon, followed by every roll with its level, grams on hand, price paid, and the projects that use it.",
  },
  {
    id: "maintenance",
    label: "Printer maintenance",
    caption: "Due dates and service history",
    src: "/screens/maintenance.webp",
    thumb: "/screens/maintenance-thumb.webp",
    width: 1440,
    height: 3578,
    alt: "SpoolTally printer maintenance: an alert for printers that are overdue or due today, forms to add a printer and record finished maintenance, and a printer list with each next due date and last service.",
  },
] as const;

const SCROLL_PX_PER_SECOND = 55;
const HOLD_MS = 2200;

export function ScreenshotShowcase({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  // The tour runs until the visitor takes over by scrolling or picking a screen.
  const [touring, setTouring] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!touring || !viewport) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let timer = 0;
    let last = performance.now();
    let position = 0;
    let hold = HOLD_MS;
    viewport.scrollTop = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(now - last, 100);
      last = now;
      const max = viewport.scrollHeight - viewport.clientHeight;

      // Hidden (small screens) or still loading: check back occasionally instead of every frame.
      if (max <= 0) {
        timer = window.setTimeout(() => {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }, 1000);
        return;
      }

      if (!pausedRef.current) {
        if (hold > 0) {
          hold -= elapsed;
        } else if (position < max) {
          position = Math.min(max, position + (SCROLL_PX_PER_SECOND * elapsed) / 1000);
          viewport.scrollTop = position;
          if (position >= max) hold = HOLD_MS;
        } else {
          setActive((index) => (index + 1) % screens.length);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [active, touring]);

  const screen = screens[active];

  function showScreen(index: number) {
    setTouring(false);
    setActive(index);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }

  const takeOver = () => setTouring(false);

  return (
    <div
      className={`gap-3 ${className}`}
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <figure className={`${styles.window} flex min-w-0 flex-1 flex-col`}>
        <figcaption className="flex shrink-0 items-center gap-3 bg-[#0b1b2b] px-4 py-2.5">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-white/25" />
            <span className="h-2 w-2 rounded-full bg-white/25" />
            <span className="h-2 w-2 rounded-full bg-white/25" />
          </span>
          <span className="min-w-0 truncate text-xs font-semibold text-white">
            {screen.label}
            <span className="ml-2 font-normal text-slate-400">{screen.caption}</span>
          </span>
          <span className="ml-auto hidden shrink-0 text-[11px] font-medium text-slate-400 xl:block">
            Scroll to explore
          </span>
        </figcaption>

        <div className="relative min-h-0 flex-1">
          <div
            ref={viewportRef}
            role="region"
            aria-label={`${screen.label} screenshot`}
            tabIndex={0}
            className={`${styles.viewport} absolute inset-0 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400`}
            onWheel={takeOver}
            onTouchStart={takeOver}
            onPointerDown={takeOver}
            onKeyDown={takeOver}
          >
            <Image
              key={screen.id}
              src={screen.src}
              width={screen.width}
              height={screen.height}
              alt={screen.alt}
              unoptimized
              className={`${styles.screen} block h-auto w-full`}
            />
          </div>
        </div>
      </figure>

      <div className="flex w-[clamp(118px,24%,190px)] shrink-0 flex-col gap-3" role="group" aria-label="Choose a screenshot">
        {screens.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => showScreen(index)}
              className={`${styles.thumb} group relative min-h-0 flex-1 cursor-pointer overflow-hidden rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                selected ? styles.thumbSelected : ""
              }`}
            >
              <Image
                src={item.thumb}
                alt=""
                fill
                sizes="190px"
                unoptimized
                className={`object-cover object-top transition-opacity duration-200 ${
                  selected ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                }`}
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent px-3 pt-7 pb-2.5 text-[11px] leading-tight font-semibold text-white">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
