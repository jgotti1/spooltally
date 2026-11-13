"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A drop-in replacement for the browser's <select>. The native list is drawn by the operating system, which on macOS is a
 * see-through "frosted glass" panel that lets the page background glow through as blurry patches, and on Windows could
 * show white-on-white text in dark mode. This one draws its own solid list, so it looks the same everywhere.
 *
 * It takes the same props and <option>/<optgroup> children as <select>, and calls onChange with `{ target: { value } }`,
 * so switching a field over is just renaming the tag. Keyboard: Enter/Space/arrows open it, arrows move, Enter picks,
 * Escape closes, typing a letter jumps to a matching option.
 */

type Item = { kind: "option"; value: string; label: string; disabled: boolean } | { kind: "group"; label: string };

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : isValidElement(child) ? textOf((child.props as { children?: ReactNode }).children) : ""))
    .join("");
}

function collect(children: ReactNode, items: Item[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }>;
    if (element.type === "optgroup") {
      items.push({ kind: "group", label: element.props.label ?? "" });
      collect(element.props.children, items);
    } else if (element.type === "option") {
      const label = textOf(element.props.children);
      items.push({ kind: "option", value: String(element.props.value ?? label), label, disabled: Boolean(element.props.disabled) });
    } else if (element.props.children) {
      collect(element.props.children, items); // fragments
    }
  });
}

/** Layout classes (width, margins, flex sizing) belong on the wrapper; the look (border, padding, colors) stays on the button. */
const LAYOUT = /^(?:[a-z0-9]+:)*(?:w-|min-w-|max-w-|flex-|grow|shrink|basis-|m[trblxy]?-|block$|inline-block$|self-)/;

type SelectProps = {
  value: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
};

export function Select({ value, onChange, children, className = "", id, title, required, disabled, autoFocus, "aria-label": ariaLabel }: SelectProps) {
  const listId = useId();
  const items = useMemo(() => {
    const collected: Item[] = [];
    collect(children, collected);
    return collected;
  }, [children]);
  const options = items.filter((item): item is Extract<Item, { kind: "option" }> => item.kind === "option");
  const current = String(value);
  const selected = options.find((option) => option.value === current);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const tokens = className.split(/\s+/).filter(Boolean);
  const wrapperClass = tokens.filter((t) => LAYOUT.test(t)).join(" ");
  const buttonClass = tokens.filter((t) => !LAYOUT.test(t)).join(" ");

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const flip = below < 200 && above > below;
    setBox(
      flip
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(320, above - 4) }
        : { left: rect.left, width: rect.width, top: rect.bottom + 4, maxHeight: Math.min(320, below - 4) },
    );
  }, []);

  function openList() {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === current);
    setActive(index >= 0 ? index : 0);
    place();
    setOpen(true);
  }

  function choose(option: Extract<Item, { kind: "option" }>) {
    if (option.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== current) onChange?.({ target: { value: option.value } });
  }

  // Close on outside click, on resize, and when anything but the list itself scrolls.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);

  // Keep the highlighted row in view.
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function move(step: number) {
    let next = active;
    for (let i = 0; i < options.length; i++) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActive(next);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase(), at: now };
      const hit = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  let optionIndex = -1;
  return (
    <span className={`relative inline-block ${wrapperClass}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        style={{ paddingRight: "2.25rem" }}
        className={`${buttonClass} relative block w-full cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {/* Every label is laid out invisibly in the same cell, so the button is as wide as the longest option and doesn't resize as the choice changes. */}
        <span className="grid">
          <span className="col-start-1 row-start-1 truncate">{selected?.label ?? ""}&nbsp;</span>
          {options.map((option) => (
            <span key={option.value} aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">
              {option.label}
            </span>
          ))}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Lets the browser's own "please fill out this field" check work for required dropdowns. */}
      {required && <input tabIndex={-1} aria-hidden="true" required value={current} onChange={() => {}} className="pointer-events-none absolute inset-0 opacity-0" />}
      {open &&
        box &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            style={{ position: "fixed", left: box.left, minWidth: box.width, top: box.top, bottom: box.bottom, maxHeight: box.maxHeight }}
            className="z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#0f1a27] dark:shadow-black/50"
          >
            {items.map((item, i) => {
              if (item.kind === "group") {
                return (
                  <div key={`g${i}`} className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500">
                    {item.label}
                  </div>
                );
              }
              optionIndex += 1;
              const index = optionIndex;
              const isSelected = item.value === current;
              return (
                <div
                  key={`${item.value}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={item.disabled || undefined}
                  data-index={index}
                  onMouseEnter={() => !item.disabled && setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                    item.disabled
                      ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                      : index === active
                        ? "bg-blue-50 text-blue-900 dark:bg-blue-500/20 dark:text-white"
                        : "text-slate-800 dark:text-slate-200"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 ${isSelected ? "" : "invisible"}`}>
                    <path d="m4.5 10.5 3.2 3.2 7.8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item.label}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </span>
  );
}
