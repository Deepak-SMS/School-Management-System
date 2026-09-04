"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";

/** An `Input` with a built-in show/hide toggle — every password field in the app should use this instead of `<Input type="password">` directly. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailingIcon">>((props, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      ref={ref}
      type={visible ? "text" : "password"}
      trailingIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="pointer-events-auto rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
});
PasswordInput.displayName = "PasswordInput";
