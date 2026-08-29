"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// Hydration gate. useSyncExternalStore is the sanctioned way to ask "are we on
// the client yet": it returns the server snapshot during SSR and the client one
// afterwards, with no state written from an effect.
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

export type SelectOption = {
  value: string;
  label: string;
  // Optional second line, for options that need explaining (match modes,
  // check-in cadences). Shown in the popup only, never in the closed trigger.
  hint?: string;
  disabled?: boolean;
};

// A dropdown that matches the rest of the app instead of the operating system.
//
// PROGRESSIVE ENHANCEMENT, and it is the reason for the shape of this file: a
// real <select> is always in the DOM carrying the name and the value, so every
// GET form (the home search) and every server action keeps working exactly as
// before — including before hydration and with JavaScript off, where the
// native control is what the user actually sees and operates. Once mounted,
// the native control is hidden from sight and from the tab order, and this
// listbox drives it.
//
// Native <option> elements cannot be styled beyond colour in any browser, so a
// custom listbox is the only way to get hints, a gold selected state and the
// same panel treatment as the calendar. The cost is that every keyboard and
// ARIA behaviour the native control gave us for free has to be rebuilt here —
// which is what the rest of this component is.
export default function Select({
  options,
  name,
  id,
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  className = "",
  ariaLabel,
  size = "md",
}: {
  options: SelectOption[];
  name?: string;
  id?: string;
  // Controlled (pass both) or uncontrolled (pass defaultValue, or neither).
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // Shown when nothing is selected. Rendered as a real disabled <option> so
  // the native control shows it too.
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  // "sm" for dense rows (an admin desk action, a media card footer). The
  // sizing lives in .input-sm rather than utility classes, because .input sets
  // its padding unlayered and a utility cannot reach it.
  size?: "sm" | "md";
}) {
  const reactId = useId();
  const triggerId = id ?? `sel-${reactId}`;
  const listId = `${triggerId}-list`;

  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? value : internal;

  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  // Typeahead buffer: matches the native control's "type j-a-z to jump" trick.
  const typed = useRef({ term: "", at: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === current),
    [options, current]
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function commit(next: string) {
    if (!controlled) setInternal(next);
    onChange?.(next);
    // Keep the real control in step, and let anything listening to the native
    // element (a form's own handlers, browser autofill) see a genuine change.
    const el = selectRef.current;
    if (el && el.value !== next) {
      el.value = next;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function openAt(index: number) {
    if (disabled) return;
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    commit(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Step past disabled options rather than landing on one.
  function step(from: number, delta: number): number {
    const n = options.length;
    if (n === 0) return 0;
    let i = from;
    for (let guard = 0; guard < n; guard += 1) {
      i = (i + delta + n) % n;
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function edge(dir: "first" | "last"): number {
    return dir === "first" ? step(-1, 1) : step(options.length, -1);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // Capture, so a click on something that stops propagation still closes us.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const key = e.key;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        e.preventDefault();
        openAt(selectedIndex);
      }
      return;
    }

    if (key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => step(i, 1));
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => step(i, -1));
      return;
    }
    if (key === "Home") {
      e.preventDefault();
      setActive(edge("first"));
      return;
    }
    if (key === "End") {
      e.preventDefault();
      setActive(edge("last"));
      return;
    }
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      choose(active);
      return;
    }
    if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.term =
        now - typed.current.at > 800 ? key : typed.current.term + key;
      typed.current.at = now;
      const term = typed.current.term.toLowerCase();
      const hit = options.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(term)
      );
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* The real control. Visible and fully functional until hydration. */}
      <select
        ref={selectRef}
        id={mounted ? undefined : triggerId}
        name={name}
        value={current}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-hidden={mounted}
        tabIndex={mounted ? -1 : undefined}
        onChange={(e) => {
          if (!controlled) setInternal(e.target.value);
          onChange?.(e.target.value);
        }}
        className={
          mounted
            ? "pointer-events-none absolute h-0 w-0 opacity-0"
            : `input appearance-none ${size === "sm" ? "input-sm" : ""}`
        }
      >
        {placeholder !== undefined && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>

      {mounted && (
        <>
          <button
            ref={triggerRef}
            type="button"
            id={triggerId}
            disabled={disabled}
            onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
            onKeyDown={onKeyDown}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-label={ariaLabel}
            className={`input ${size === "sm" ? "input-sm gap-2" : "gap-3"} flex items-center justify-between text-left ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${open ? "border-gold/60" : ""}`}
          >
            <span className={selected ? "truncate text-ink" : "truncate text-faint"}>
              {selected?.label ?? placeholder ?? "Select…"}
            </span>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-faint transition-transform ${
                open ? "rotate-180" : ""
              }`}
            >
              <path
                d="M5 7.5 10 12.5 15 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {open && (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onKeyDown}
              className="card absolute z-50 mt-2 max-h-72 w-full overflow-y-auto p-1.5"
            >
              {options.length === 0 && (
                <li className="px-3 py-2 text-sm text-faint">Nothing to choose</li>
              )}
              {options.map((o, i) => {
                const isSelected = o.value === current;
                const isActive = i === active;
                return (
                  <li key={o.value}>
                    <div
                      id={`${listId}-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onClick={() => choose(i)}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        o.disabled
                          ? "cursor-not-allowed text-faint"
                          : isActive
                            ? "bg-raised text-ink"
                            : "text-muted"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          isSelected ? "bg-gold" : "bg-transparent"
                        }`}
                      />
                      <span className="min-w-0">
                        <span
                          className={`block ${isSelected ? "text-gold-soft" : ""}`}
                        >
                          {o.label}
                        </span>
                        {o.hint && (
                          <span className="mt-0.5 block text-xs leading-5 text-faint">
                            {o.hint}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
