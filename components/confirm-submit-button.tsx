"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Submits a form only after the person confirms what it will do.
 *
 * This used to be `window.confirm`, which cannot say which record it is about
 * in any readable way, cannot be styled to signal danger, and on some browsers
 * defaults its focus to OK. A dialog can name the object and the consequence,
 * and it opens with Cancel as the safe default.
 *
 * The dialog renders in a portal, outside the form, so the confirm button
 * cannot itself be the submit button. It clicks a hidden one that is inside
 * the form instead — which also means the form's own action, method and
 * validation stay exactly as the caller wrote them.
 */
export function ConfirmSubmitButton({
  message,
  title = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  children,
  className,
  variant = "ghost",
  size = "sm",
  disabled = false,
  name,
  value,
}: {
  /** What will happen, naming the object and the consequence. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Colours the confirm button. Off for actions that are risky but not losses. */
  destructive?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  /**
   * Carried on the hidden submit button, for forms that branch on which
   * button was pressed.
   */
  name?: string;
  value?: string;
}) {
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      {/* Inside the form, never shown. The dialog's confirm clicks this. */}
      <button
        ref={submitRef}
        type="submit"
        name={name}
        value={value}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                setOpen(false);
                submitRef.current?.click();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
