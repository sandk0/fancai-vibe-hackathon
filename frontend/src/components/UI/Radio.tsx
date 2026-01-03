import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Radio button variants using class-variance-authority (cva)
 *
 * Design system requirements:
 * - Minimum 44px touch target per Apple HIG
 * - Uses CSS custom properties for theming
 * - Focus styles with ring-2 and ring-offset
 */
const radioContainerVariants = cva(
  // Base container styles - provides 44px touch target
  [
    "relative inline-flex items-center justify-center",
    "min-h-[44px] min-w-[44px]",
    "cursor-pointer",
    "touch-action-manipulation",
  ],
  {
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      disabled: false,
    },
  }
)

const radioCircleVariants = cva(
  // Base radio circle styles
  [
    "relative flex items-center justify-center",
    "size-5 rounded-full",
    "border-2 transition-all duration-200",
    // Focus styles
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-[var(--color-accent-500)]",
    "ring-offset-[var(--color-bg-base)]",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-[var(--color-border-default)]",
          "bg-[var(--color-bg-base)]",
          "hover:border-[var(--color-accent-500)]",
        ],
        error: [
          "border-[var(--color-error)]",
          "bg-[var(--color-bg-base)]",
          "hover:border-[var(--color-error)]",
        ],
      },
      checked: {
        true: "border-[var(--color-accent-600)]",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "error",
        checked: true,
        className: "border-[var(--color-error)]",
      },
    ],
    defaultVariants: {
      variant: "default",
      checked: false,
    },
  }
)

const radioDotVariants = cva(
  // Base dot styles
  [
    "size-2.5 rounded-full",
    "transition-all duration-200",
  ],
  {
    variants: {
      variant: {
        default: "bg-[var(--color-accent-600)]",
        error: "bg-[var(--color-error)]",
      },
      checked: {
        true: "scale-100 opacity-100",
        false: "scale-0 opacity-0",
      },
    },
    defaultVariants: {
      variant: "default",
      checked: false,
    },
  }
)

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Error variant styling */
  variant?: "default" | "error"
  /** Label text to display next to radio button */
  label?: string
  /** Helper text displayed below label */
  helperText?: string
  /** Error message displayed when variant is error */
  errorMessage?: string
  /** Class name for the container wrapper */
  containerClassName?: string
}

/**
 * Radio component with animated dot and touch-friendly target
 *
 * @example
 * // Basic radio button
 * <Radio name="option" value="1" label="Option 1" />
 *
 * @example
 * // Radio with error state
 * <Radio
 *   name="required"
 *   variant="error"
 *   label="Required option"
 *   errorMessage="Please select an option"
 * />
 *
 * @example
 * // Disabled radio
 * <Radio name="disabled" disabled label="Cannot select" />
 */
const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      className,
      containerClassName,
      variant = "default",
      label,
      helperText,
      errorMessage,
      disabled,
      checked,
      defaultChecked,
      id,
      onChange,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const generatedId = React.useId()
    const radioId = id || generatedId
    const helperId = `${radioId}-helper`
    const errorId = `${radioId}-error`

    // Track checked state for styling
    const [isChecked, setIsChecked] = React.useState(defaultChecked || false)
    const controlledChecked = checked !== undefined ? checked : isChecked

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (checked === undefined) {
        setIsChecked(e.target.checked)
      }
      onChange?.(e)
    }

    const showError = variant === "error" && errorMessage

    return (
      <div className={cn("flex items-start gap-1", containerClassName)}>
        <label
          htmlFor={radioId}
          className={cn(
            radioContainerVariants({ disabled: !!disabled }),
            "shrink-0"
          )}
        >
          {/* Hidden native radio for accessibility */}
          <input
            type="radio"
            ref={ref}
            id={radioId}
            className="peer sr-only"
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={handleChange}
            aria-describedby={
              [showError && errorId, helperText && helperId]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={variant === "error" ? true : undefined}
            {...props}
          />

          {/* Visual radio button */}
          <span
            className={cn(
              radioCircleVariants({
                variant,
                checked: controlledChecked,
              }),
              // Peer focus state
              "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
              "peer-focus-visible:ring-[var(--color-accent-500)]",
              className
            )}
            aria-hidden="true"
          >
            {/* Animated dot */}
            <span
              className={radioDotVariants({
                variant,
                checked: controlledChecked,
              })}
            />
          </span>
        </label>

        {/* Label and helper text */}
        {(label || helperText || showError) && (
          <div className="flex flex-col justify-center min-h-[44px] py-2.5">
            {label && (
              <label
                htmlFor={radioId}
                className={cn(
                  "text-sm font-medium leading-tight cursor-pointer",
                  "text-[var(--color-text-default)]",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {helperText && !showError && (
              <span
                id={helperId}
                className="text-xs text-[var(--color-text-muted)] mt-0.5"
              >
                {helperText}
              </span>
            )}
            {showError && (
              <span
                id={errorId}
                className="text-xs text-[var(--color-error)] mt-0.5"
                role="alert"
              >
                {errorMessage}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)
Radio.displayName = "Radio"

// ============================================================================
// RadioGroup Component
// ============================================================================

interface RadioGroupContextValue {
  name: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  variant?: "default" | "error"
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

function useRadioGroupContext() {
  return React.useContext(RadioGroupContext)
}

export interface RadioGroupProps {
  /** Group name for all radio buttons */
  name: string
  /** Currently selected value */
  value?: string
  /** Default selected value (uncontrolled) */
  defaultValue?: string
  /** Callback when selection changes */
  onChange?: (value: string) => void
  /** Disable all radio buttons in group */
  disabled?: boolean
  /** Error variant for all radio buttons */
  variant?: "default" | "error"
  /** Label for the radio group */
  label?: string
  /** Helper text for the group */
  helperText?: string
  /** Error message for the group */
  errorMessage?: string
  /** Layout orientation */
  orientation?: "horizontal" | "vertical"
  /** Required field */
  required?: boolean
  /** Children radio buttons */
  children: React.ReactNode
  /** Container class name */
  className?: string
}

/**
 * RadioGroup component for grouping related radio buttons
 *
 * @example
 * // Basic radio group
 * <RadioGroup name="size" label="Select size">
 *   <RadioGroupItem value="sm" label="Small" />
 *   <RadioGroupItem value="md" label="Medium" />
 *   <RadioGroupItem value="lg" label="Large" />
 * </RadioGroup>
 *
 * @example
 * // Controlled radio group
 * <RadioGroup
 *   name="plan"
 *   label="Choose plan"
 *   value={selectedPlan}
 *   onChange={setSelectedPlan}
 * >
 *   <RadioGroupItem value="free" label="Free" />
 *   <RadioGroupItem value="pro" label="Pro" />
 * </RadioGroup>
 *
 * @example
 * // Radio group with error
 * <RadioGroup
 *   name="required"
 *   variant="error"
 *   label="Required selection"
 *   errorMessage="Please select an option"
 * >
 *   <RadioGroupItem value="a" label="Option A" />
 *   <RadioGroupItem value="b" label="Option B" />
 * </RadioGroup>
 */
const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      name,
      value,
      defaultValue,
      onChange,
      disabled,
      variant = "default",
      label,
      helperText,
      errorMessage,
      orientation = "vertical",
      required,
      children,
      className,
    },
    ref
  ) => {
    // Handle uncontrolled state
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const controlledValue = value !== undefined ? value : internalValue

    const handleChange = React.useCallback(
      (newValue: string) => {
        if (value === undefined) {
          setInternalValue(newValue)
        }
        onChange?.(newValue)
      },
      [value, onChange]
    )

    const contextValue = React.useMemo(
      () => ({
        name,
        value: controlledValue,
        onChange: handleChange,
        disabled,
        variant,
      }),
      [name, controlledValue, handleChange, disabled, variant]
    )

    const groupId = React.useId()
    const labelId = `${groupId}-label`
    const helperId = `${groupId}-helper`
    const errorId = `${groupId}-error`
    const showError = variant === "error" && errorMessage

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          role="radiogroup"
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={
            [showError && errorId, helperText && helperId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-required={required}
          aria-invalid={variant === "error" ? true : undefined}
          className={cn("flex flex-col gap-1", className)}
        >
          {label && (
            <span
              id={labelId}
              className={cn(
                "text-sm font-medium text-[var(--color-text-default)]",
                disabled && "opacity-50"
              )}
            >
              {label}
              {required && (
                <span className="text-[var(--color-error)] ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          )}

          <div
            className={cn(
              "flex",
              orientation === "vertical" ? "flex-col" : "flex-row flex-wrap gap-x-4"
            )}
          >
            {children}
          </div>

          {helperText && !showError && (
            <span
              id={helperId}
              className="text-xs text-[var(--color-text-muted)] mt-1"
            >
              {helperText}
            </span>
          )}
          {showError && (
            <span
              id={errorId}
              className="text-xs text-[var(--color-error)] mt-1"
              role="alert"
            >
              {errorMessage}
            </span>
          )}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

// ============================================================================
// RadioGroupItem Component
// ============================================================================

export interface RadioGroupItemProps
  extends Omit<RadioProps, "name" | "checked" | "onChange" | "variant"> {
  /** Value for this radio option */
  value: string
}

/**
 * RadioGroupItem - Radio button for use within RadioGroup
 *
 * @example
 * <RadioGroup name="options">
 *   <RadioGroupItem value="1" label="Option 1" />
 *   <RadioGroupItem value="2" label="Option 2" />
 * </RadioGroup>
 */
const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ value, disabled: itemDisabled, ...props }, ref) => {
    const context = useRadioGroupContext()

    if (!context) {
      console.warn(
        "RadioGroupItem must be used within a RadioGroup component"
      )
      return null
    }

    const { name, value: groupValue, onChange, disabled: groupDisabled, variant } = context
    const isDisabled = itemDisabled || groupDisabled
    const isChecked = groupValue === value

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        onChange?.(value)
      }
    }

    return (
      <Radio
        ref={ref}
        name={name}
        value={value}
        checked={isChecked}
        onChange={handleChange}
        disabled={isDisabled}
        variant={variant}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export {
  Radio,
  RadioGroup,
  RadioGroupItem,
  radioCircleVariants,
  radioContainerVariants,
  radioDotVariants,
}
