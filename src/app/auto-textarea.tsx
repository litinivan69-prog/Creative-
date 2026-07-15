"use client";

import { useCallback, useEffect, useRef } from "react";

type AutoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea without an inner scrollbox: grows with its content so the text is
 * fully visible and the PAGE scrolls, not the field. Drop-in replacement for
 * <textarea> (rows works as the minimum height).
 */
export function AutoTextarea({ onInput, style, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [resize, props.defaultValue, props.value]);

  return (
    <textarea
      ref={ref}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...props}
    />
  );
}
