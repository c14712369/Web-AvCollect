'use client';

import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      for (const s of shortcuts) {
        if (e.key.toLowerCase() !== s.key.toLowerCase()) continue;

        const needsModifier = s.ctrl || s.meta;
        const modifierPressed = e.ctrlKey || e.metaKey;
        if (needsModifier && !modifierPressed) continue;
        if (!needsModifier && modifierPressed) continue;
        if (!!s.shift !== e.shiftKey) continue;

        if (!needsModifier && isTyping) continue;

        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
