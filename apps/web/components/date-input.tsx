"use client";

import { InputHTMLAttributes } from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange: (value: string) => void;
};

export function localDateInput(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMonthInput(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function localMonthStartInput(value = new Date()) {
  return localDateInput(new Date(value.getFullYear(), value.getMonth(), 1));
}

export function DateInput({ className, onChange, ...props }: DateInputProps) {
  return (
    <input
      {...props}
      className={className}
      onChange={(event) => onChange(event.target.value)}
      type="date"
    />
  );
}
