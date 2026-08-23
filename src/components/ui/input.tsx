import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leadingIcon, trailingIcon, ...props }, ref) => {
    if (leadingIcon || trailingIcon) {
      return (
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&>svg]:size-4">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            aria-invalid={invalid}
            className={cn(
              "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50",
              leadingIcon && "pl-9",
              trailingIcon && "pr-9",
              invalid && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30",
              className,
            )}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-3 flex items-center text-muted-foreground [&>svg]:size-4">
              {trailingIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
