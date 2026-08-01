import { forwardRef, useImperativeHandle, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FormulaEquationInputHandle {
  insertAtCursor: (snippet: string) => void;
  focus: () => void;
}

interface FormulaEquationInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  hasError?: boolean;
  placeholder?: string;
}

export const FormulaEquationInput = forwardRef<FormulaEquationInputHandle, FormulaEquationInputProps>(
  function FormulaEquationInput({ value, onChange, onFocus, hasError, placeholder }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      insertAtCursor: (snippet: string) => {
        const el = inputRef.current;
        if (!el) {
          onChange(`${value}${snippet}`);
          return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
        onChange(next);
        requestAnimationFrame(() => {
          const pos = start + snippet.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        });
      },
    }));

    return (
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        aria-invalid={hasError}
        className={cn(
          "font-mono text-sm",
          hasError && "border-destructive focus-visible:ring-destructive",
        )}
      />
    );
  },
);
