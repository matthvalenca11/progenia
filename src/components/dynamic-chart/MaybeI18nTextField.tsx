import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  normalizeToI18nText,
  readI18nField,
  writeI18nField,
  type MaybeI18nText,
} from "@/types/dynamicChart";

type EditLanguage = "pt" | "en";

interface MaybeI18nTextFieldProps {
  label: string;
  value: MaybeI18nText | undefined;
  onChange: (next: MaybeI18nText) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function MaybeI18nTextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  className,
}: MaybeI18nTextFieldProps) {
  const normalized = normalizeToI18nText(value);
  const [editLanguage, setEditLanguage] = useState<EditLanguage>("pt");
  const fieldValue = readI18nField(normalized, editLanguage);

  const handleChange = (text: string) => {
    onChange(writeI18nField(normalized, editLanguage, text));
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <ToggleGroup
          type="single"
          value={editLanguage}
          onValueChange={(v) => v && setEditLanguage(v as EditLanguage)}
          className="h-7 rounded-md border bg-muted/40 p-0.5"
        >
          <ToggleGroupItem
            value="pt"
            className="h-6 rounded px-2.5 text-[11px] font-semibold data-[state=on]:bg-background"
          >
            PT
          </ToggleGroupItem>
          <ToggleGroupItem
            value="en"
            className="h-6 rounded px-2.5 text-[11px] font-semibold data-[state=on]:bg-background"
          >
            EN
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <InputComponent
        value={fieldValue}
        onChange={(e) => handleChange(e.target.value)}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        className={multiline ? undefined : undefined}
      />
      {editLanguage === "pt" && normalized.en.trim() && (
        <p className="text-[11px] text-muted-foreground truncate">
          EN: {normalized.en}
        </p>
      )}
      {editLanguage === "en" && normalized.pt.trim() && (
        <p className="text-[11px] text-muted-foreground truncate">
          PT: {normalized.pt}
        </p>
      )}
    </div>
  );
}
