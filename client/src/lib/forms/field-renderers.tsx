/**
 * Form Field Renderers
 *
 * Composants de rendu pour chaque type de champ du formulaire dynamique.
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Check, ChevronsUpDown, Star, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import type { FieldConfig, FieldRenderProps, SelectOption } from "./types";

// ============================================================================
// Field Wrapper
// ============================================================================

interface FieldWrapperProps {
  field: FieldConfig;
  error?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ field, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-2">
      {field.type !== "checkbox" && field.type !== "switch" && (
        <Label htmlFor={field.id} className={cn(error && "text-destructive")}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {children}
      {field.helpText && !error && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ============================================================================
// Text Input
// ============================================================================

export function TextField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const inputType = field.type === "password" ? "password" :
                    field.type === "email" ? "email" :
                    field.type === "url" ? "url" :
                    field.type === "tel" ? "tel" :
                    field.type === "number" ? "number" : "text";

  return (
    <FieldWrapper field={field} error={error}>
      <Input
        id={field.id}
        type={inputType}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.type === "number" ? e.target.valueAsNumber : e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled || field.disabled}
        readOnly={field.readOnly}
        min={field.min}
        max={field.max}
        step={field.step}
        minLength={field.minLength}
        maxLength={field.maxLength}
        className={cn(error && "border-destructive")}
        {...(field.props as Record<string, unknown>)}
      />
    </FieldWrapper>
  );
}

// ============================================================================
// Textarea
// ============================================================================

export function TextareaField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <Textarea
        id={field.id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled || field.disabled}
        readOnly={field.readOnly}
        rows={field.rows ?? 3}
        maxLength={field.maxLength}
        className={cn(error && "border-destructive")}
        {...(field.props as Record<string, unknown>)}
      />
    </FieldWrapper>
  );
}

// ============================================================================
// Select
// ============================================================================

export function SelectField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <Select
        value={(value as string) ?? ""}
        onValueChange={onChange}
        disabled={disabled || field.disabled}
      >
        <SelectTrigger
          id={field.id}
          className={cn(error && "border-destructive")}
        >
          <SelectValue placeholder={field.placeholder ?? "Sélectionner..."} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                <span className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  {option.label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

// ============================================================================
// Multi-Select (Combobox style)
// ============================================================================

export function MultiSelectField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const [open, setOpen] = React.useState(false);
  const selectedValues = (value as string[]) ?? [];

  const toggleOption = (optionValue: string) => {
    const newValue = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];
    onChange(newValue);
  };

  return (
    <FieldWrapper field={field} error={error}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || field.disabled}
            className={cn(
              "w-full justify-between font-normal",
              error && "border-destructive"
            )}
          >
            {selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedValues.slice(0, 3).map((val) => {
                  const option = field.options?.find((o) => o.value === val);
                  return (
                    <Badge key={val} variant="secondary" className="text-xs">
                      {option?.label ?? val}
                    </Badge>
                  );
                })}
                {selectedValues.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedValues.length - 3}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">
                {field.placeholder ?? "Sélectionner..."}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher..." />
            <CommandList>
              <CommandEmpty>Aucun résultat.</CommandEmpty>
              <CommandGroup>
                {field.options?.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleOption(option.value)}
                      disabled={option.disabled}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}

// ============================================================================
// Radio Group
// ============================================================================

export function RadioField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <RadioGroup
        value={(value as string) ?? ""}
        onValueChange={onChange}
        disabled={disabled || field.disabled}
        className="space-y-2"
      >
        {field.options?.map((option) => {
          const Icon = option.icon;
          return (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option.value}
                id={`${field.id}-${option.value}`}
                disabled={option.disabled}
              />
              <Label
                htmlFor={`${field.id}-${option.value}`}
                className="flex items-center gap-2 font-normal cursor-pointer"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {option.label}
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </FieldWrapper>
  );
}

// ============================================================================
// Checkbox
// ============================================================================

export function CheckboxField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <div className="flex items-start space-x-3 space-y-0">
      <Checkbox
        id={field.id}
        checked={(value as boolean) ?? false}
        onCheckedChange={onChange}
        disabled={disabled || field.disabled}
        className={cn(error && "border-destructive")}
      />
      <div className="space-y-1">
        <Label htmlFor={field.id} className="font-normal cursor-pointer">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Switch
// ============================================================================

export function SwitchField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <div className="flex items-center justify-between space-x-3">
      <div className="space-y-0.5">
        <Label htmlFor={field.id} className="font-normal">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Switch
        id={field.id}
        checked={(value as boolean) ?? false}
        onCheckedChange={onChange}
        disabled={disabled || field.disabled}
      />
    </div>
  );
}

// ============================================================================
// Date Picker
// ============================================================================

export function DateField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const date = value ? new Date(value as string) : undefined;

  return (
    <FieldWrapper field={field} error={error}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={field.id}
            variant="outline"
            disabled={disabled || field.disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP", { locale: fr }) : field.placeholder ?? "Choisir une date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d?.toISOString())}
            locale={fr}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}

// ============================================================================
// DateTime Picker
// ============================================================================

export function DateTimeField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const dateValue = value ? new Date(value as string) : undefined;

  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) {
      onChange(undefined);
      return;
    }
    // Preserve existing time if any
    if (dateValue) {
      newDate.setHours(dateValue.getHours(), dateValue.getMinutes());
    }
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const newDate = dateValue ? new Date(dateValue) : new Date();
    newDate.setHours(hours, minutes);
    onChange(newDate.toISOString());
  };

  return (
    <FieldWrapper field={field} error={error}>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled || field.disabled}
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !dateValue && "text-muted-foreground",
                error && "border-destructive"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, "PPP", { locale: fr }) : "Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateChange}
              locale={fr}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          value={dateValue ? format(dateValue, "HH:mm") : ""}
          onChange={handleTimeChange}
          disabled={disabled || field.disabled}
          className={cn("w-24", error && "border-destructive")}
        />
      </div>
    </FieldWrapper>
  );
}

// ============================================================================
// Time Picker
// ============================================================================

export function TimeField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <Input
        id={field.id}
        type="time"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || field.disabled}
        className={cn(error && "border-destructive")}
      />
    </FieldWrapper>
  );
}

// ============================================================================
// Slider
// ============================================================================

export function SliderField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const numValue = (value as number) ?? field.min ?? 0;

  return (
    <FieldWrapper field={field} error={error}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Slider
            id={field.id}
            value={[numValue]}
            onValueChange={([v]) => onChange(v)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            disabled={disabled || field.disabled}
            className="flex-1"
          />
          <span className="ml-4 w-12 text-right text-sm font-medium">{numValue}</span>
        </div>
        {field.marks && (
          <div className="flex justify-between text-xs text-muted-foreground">
            {field.marks.map((mark) => (
              <span key={mark.value}>{mark.label}</span>
            ))}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}

// ============================================================================
// Rating
// ============================================================================

export function RatingField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const maxRating = field.maxRating ?? 5;
  const currentRating = (value as number) ?? 0;

  return (
    <FieldWrapper field={field} error={error}>
      <div className="flex gap-1">
        {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !disabled && !field.disabled && onChange(star)}
            disabled={disabled || field.disabled}
            className={cn(
              "transition-colors",
              disabled || field.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
            )}
          >
            <Star
              className={cn(
                "h-6 w-6",
                star <= currentRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
    </FieldWrapper>
  );
}

// ============================================================================
// File Upload
// ============================================================================

export function FileField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const files = field.multiple ? (value as File[]) ?? [] : value ? [value as File] : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    if (field.multiple) {
      onChange([...files, ...Array.from(selectedFiles)]);
    } else {
      onChange(selectedFiles[0]);
    }
  };

  const removeFile = (index: number) => {
    if (field.multiple) {
      const newFiles = [...files];
      newFiles.splice(index, 1);
      onChange(newFiles);
    } else {
      onChange(undefined);
    }
  };

  return (
    <FieldWrapper field={field} error={error}>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={field.accept}
          multiple={field.multiple}
          onChange={handleFileChange}
          disabled={disabled || field.disabled}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || field.disabled}
          className={cn("w-full", error && "border-destructive")}
        >
          <Upload className="mr-2 h-4 w-4" />
          {field.placeholder ?? "Choisir un fichier"}
        </Button>

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeFile(index)}
                  disabled={disabled || field.disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}

// ============================================================================
// Color Picker
// ============================================================================

export function ColorField({ field, value, onChange, error, disabled }: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <div className="flex items-center gap-2">
        <input
          id={field.id}
          type="color"
          value={(value as string) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || field.disabled}
          className="h-10 w-14 cursor-pointer rounded border p-1"
        />
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          disabled={disabled || field.disabled}
          className={cn("flex-1", error && "border-destructive")}
        />
      </div>
    </FieldWrapper>
  );
}

// ============================================================================
// Field Renderer Map
// ============================================================================

export const fieldRenderers: Record<string, React.FC<FieldRenderProps>> = {
  text: TextField,
  email: TextField,
  password: TextField,
  url: TextField,
  tel: TextField,
  number: TextField,
  textarea: TextareaField,
  select: SelectField,
  "multi-select": MultiSelectField,
  combobox: MultiSelectField,
  radio: RadioField,
  checkbox: CheckboxField,
  switch: SwitchField,
  date: DateField,
  datetime: DateTimeField,
  time: TimeField,
  slider: SliderField,
  rating: RatingField,
  file: FileField,
  color: ColorField,
};

export function renderField(props: FieldRenderProps): React.ReactNode {
  const { field } = props;

  // Custom render function
  if (field.render) {
    return field.render(props);
  }

  // Get renderer for field type
  const Renderer = fieldRenderers[field.type];
  if (Renderer) {
    return <Renderer {...props} />;
  }

  // Fallback to text field
  return <TextField {...props} />;
}
