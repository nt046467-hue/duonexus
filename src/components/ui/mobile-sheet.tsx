"use client";

/**
 * MobileSheet — Adaptive modal wrapper
 *
 * • Mobile  (<768 px): slides up as a native-feeling bottom sheet with a
 *   visible drag handle, rounded top corners, safe-area-inset bottom padding
 *   and spring animation. Overlay tap dismisses.
 * • Desktop (≥768 px): renders the existing shadcn <Dialog> centered popup,
 *   exactly as it was before — zero visual change.
 *
 * Props are a superset of DialogContent so call-sites can swap in-place.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useViewport } from "@/hooks/use-viewport";
import { cn } from "@/lib/utils";

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Invisible to screen but used for a11y — always provide. */
  descriptionSrOnly?: string;
  /** Optional visible sub-heading below title. Desktop only shows this in DialogHeader. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons / actions rendered in the footer area. */
  footer?: React.ReactNode;
  /** Extra class on the desktop DialogContent wrapper. */
  dialogClassName?: string;
  /** Extra class on the mobile sheet panel itself. */
  sheetClassName?: string;
}

export function MobileSheet({
  open,
  onOpenChange,
  title,
  descriptionSrOnly,
  description,
  children,
  footer,
  dialogClassName,
  sheetClassName,
}: MobileSheetProps) {
  const { isMobile, isMounted } = useViewport();

  /* ───────────── MOBILE: BOTTOM SHEET ───────────── */
  if (isMounted && isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer z-0"
            />

            {/* Sheet panel */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
              className={cn(
                "relative z-10 w-full max-h-[90vh] flex flex-col",
                "rounded-t-[28px] border-t border-border/60",
                "bg-background shadow-2xl overflow-hidden",
                sheetClassName
              )}
              // Stop backdrop clicks from propagating through the sheet
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-full flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="px-5 pt-1 pb-3 border-b border-border/40 shrink-0">
                <h2 className="text-base font-bold text-foreground leading-tight">
                  {title}
                </h2>
                {description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {description}
                  </p>
                )}
                {descriptionSrOnly && (
                  <span className="sr-only">{descriptionSrOnly}</span>
                )}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 overscroll-contain">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="px-5 py-4 border-t border-border/40 flex flex-col gap-2.5 shrink-0 bg-background"
                  style={{
                    paddingBottom:
                      "max(1rem, env(safe-area-inset-bottom))",
                  }}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  /* ───────────── DESKTOP: CENTERED DIALOG (unchanged) ───────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md rounded-3xl", dialogClassName)}>
        <DialogHeader>
          <DialogTitle className="font-headline font-bold text-lg">
            {title}
          </DialogTitle>
          {descriptionSrOnly && (
            <DialogDescription className="sr-only">
              {descriptionSrOnly}
            </DialogDescription>
          )}
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3.5 py-2">{children}</div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
