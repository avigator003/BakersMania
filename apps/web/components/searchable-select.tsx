"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type CommonProps = {
  label?: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  selectedOptions?: SelectOption[];
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

type Props = SingleProps | MultiProps;

const dropdownViewportGap = 8;

function isSelected(props: Props, value: string) {
  return props.multiple ? props.value.includes(value) : props.value === value;
}

function selectedOptions(props: Props) {
  const values = props.multiple ? props.value : props.value ? [props.value] : [];
  const optionMap = new Map<string, SelectOption>();
  [...(props.selectedOptions || []), ...props.options].forEach((option) => optionMap.set(option.value, option));
  return values.map((value) => optionMap.get(value)).filter(Boolean) as SelectOption[];
}

function isScrollbarPointerEvent(event: MouseEvent | TouchEvent) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;

  const point = "touches" in event ? event.touches[0] || event.changedTouches[0] : event;
  if (!point) return false;

  let element: Element | null = target;
  while (element) {
    if (element instanceof HTMLElement) {
      const rect = element.getBoundingClientRect();
      const verticalScrollbarWidth = element.offsetWidth - element.clientWidth;
      const horizontalScrollbarHeight = element.offsetHeight - element.clientHeight;
      const hasVerticalScrollbar = verticalScrollbarWidth > 0 && element.scrollHeight > element.clientHeight;
      const hasHorizontalScrollbar = horizontalScrollbarHeight > 0 && element.scrollWidth > element.clientWidth;

      if (hasVerticalScrollbar && point.clientX >= rect.right - verticalScrollbarWidth && point.clientX <= rect.right) {
        return true;
      }
      if (hasHorizontalScrollbar && point.clientY >= rect.bottom - horizontalScrollbarHeight && point.clientY <= rect.bottom) {
        return true;
      }
    }
    element = element.parentElement;
  }

  return false;
}

export function SearchableSelect(props: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selected = selectedOptions(props);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return props.options;
    return props.options.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [props.options, query]);

  const updateMenuPosition = useCallback(() => {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 320;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - dropdownViewportGap;
    const spaceAbove = rect.top - dropdownViewportGap;
    const openAbove = spaceBelow < Math.min(menuHeight, 240) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(160, openAbove ? spaceAbove : spaceBelow);

    setMenuStyle({
      left: rect.left,
      top: openAbove ? undefined : rect.bottom + dropdownViewportGap,
      bottom: openAbove ? viewportHeight - rect.top + dropdownViewportGap : undefined,
      width: rect.width,
      maxHeight: Math.min(384, availableHeight)
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target) || isScrollbarPointerEvent(event)) {
        return;
      }

      if (!wrapperRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    updateMenuPosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  function choose(value: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(value) ? props.value.filter((item) => item !== value) : [...props.value, value]);
      return;
    }

    props.onChange(value);
    setOpen(false);
    setQuery("");
  }

  function remove(value: string) {
    if (props.multiple) {
      props.onChange(props.value.filter((item) => item !== value));
      return;
    }
    props.onChange("");
  }

  const trigger = (
    <button
      className="focus-ring flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"
      disabled={props.disabled}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <span className="flex min-w-0 flex-1 flex-wrap gap-1">
        {selected.length ? (
          selected.map((option) => (
            <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-panel px-2 py-0.5 text-xs" key={option.value}>
              <span className="truncate">{option.label}</span>
              <span
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-berry/10 hover:text-berry"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(option.value);
                }}
                role="button"
                tabIndex={-1}
              >
                <X size={11} />
              </span>
            </span>
          ))
        ) : (
          <span className="truncate text-muted">{props.placeholder}</span>
        )}
      </span>
      <ChevronDown className="shrink-0 text-muted" size={16} />
    </button>
  );

  const menu = open ? (
    <div
      className="fixed z-[200] whitespace-normal rounded-md border border-line bg-panel shadow-subtle"
      ref={menuRef}
      style={menuStyle}
    >
      <label className="flex h-10 items-center gap-2 border-b border-line px-3">
        <Search size={15} className="text-muted" />
        <input
          autoFocus
          className="w-full bg-transparent text-sm outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={props.searchPlaceholder || "Search"}
          value={query}
        />
      </label>
      <div className="overflow-auto p-1" style={{ maxHeight: menuStyle.maxHeight }}>
        {filteredOptions.map((option) => {
          const active = isSelected(props, option.value);
          return (
            <button
              className={`grid w-full grid-cols-[18px_1fr] gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-panel2 ${active ? "text-mint" : ""}`}
              key={option.value}
              onClick={() => choose(option.value)}
              type="button"
            >
              <span className="mt-0.5">{active ? <Check size={16} /> : null}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{option.label}</span>
                {option.description ? <span className="block truncate text-xs text-muted">{option.description}</span> : null}
              </span>
            </button>
          );
        })}
        {!filteredOptions.length ? <p className="px-3 py-2 text-sm text-muted">{props.emptyText || "No options found."}</p> : null}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative whitespace-normal ${props.className || ""}`} ref={wrapperRef}>
      {props.label ? <label className="mb-1 block text-sm font-semibold">{props.label}</label> : null}
      {trigger}
      {props.required && !selected.length ? <input className="sr-only" required value="" onChange={() => undefined} /> : null}
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
