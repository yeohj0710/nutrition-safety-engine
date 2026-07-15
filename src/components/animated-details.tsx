"use client";

import {
  type ReactNode,
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const disclosureCloseDuration = 340;

export type AnimatedDetailsHandle = { close: () => void };

type AnimatedDetailsProps = {
  children: ReactNode;
  className: string;
  summary: ReactNode;
  summaryClassName: string;
  bodyClassName?: string;
};

export const AnimatedDetails = forwardRef<
  AnimatedDetailsHandle,
  AnimatedDetailsProps
>(function AnimatedDetails(
  { children, className, summary, summaryClassName, bodyClassName = "" },
  ref,
) {
  const panelId = useId();
  const closeTimer = useRef<number | null>(null);
  const openFrame = useRef<number | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function clearPendingMotion() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openFrame.current !== null) {
      window.cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function closeDisclosure() {
    clearPendingMotion();
    setExpanded(false);
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, disclosureCloseDuration);
  }

  function openDisclosure() {
    clearPendingMotion();
    setMounted(true);
    if (prefersReducedMotion()) {
      setExpanded(true);
      return;
    }
    openFrame.current = window.requestAnimationFrame(() => {
      openFrame.current = window.requestAnimationFrame(() => {
        setExpanded(true);
        openFrame.current = null;
      });
    });
  }

  useImperativeHandle(ref, () => ({
    close() {
      summaryRef.current?.focus();
      closeDisclosure();
    },
  }));

  useEffect(
    () => () => {
      clearPendingMotion();
    },
    [],
  );

  function toggleDisclosure() {
    if (expanded) closeDisclosure();
    else openDisclosure();
  }

  return (
    <details
      className={`animated-details ${className}`}
      data-open={expanded ? "true" : "false"}
      open={mounted}
    >
      <summary
        ref={summaryRef}
        aria-controls={panelId}
        aria-expanded={expanded}
        className={summaryClassName}
        onClick={(event) => {
          event.preventDefault();
          toggleDisclosure();
        }}
      >
        {summary}
      </summary>
      <div
        id={panelId}
        aria-hidden={!expanded}
        className="collapsible-panel"
        data-open={expanded ? "true" : "false"}
      >
        <div className="collapsible-panel-inner">
          <div className={`collapsible-panel-body ${bodyClassName}`}>
            {children}
          </div>
        </div>
      </div>
    </details>
  );
});
