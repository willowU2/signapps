"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
  }
>(({ className, value, onValueChange, disabled, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid gap-2", className)}
    role="radiogroup"
    aria-disabled={disabled}
    {...props}
  >
    {React.Children.map(props.children, (child) => {
      if (!React.isValidElement(child)) return child;
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        value,
        onValueChange,
        disabled: disabled || (child.props as Record<string, unknown>).disabled,
      });
    })}
  </div>
))
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    value?: string
    onValueChange?: (value: string) => void
  }
>(({ className, value, onValueChange, ...props }, ref) => (
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      ref={ref}
      type="radio"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={cn(
        "h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </label>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
