'use client';

import { useCallback } from 'react';

const STORAGE_KEY = 'smartlink-field-history';
const MAX_ITEMS = 5;

function readHistory(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function useFieldHistory() {
  const getSuggestions = useCallback((field: string): string[] => {
    if (typeof window === 'undefined') return [];
    return readHistory()[field] || [];
  }, []);

  const saveValue = useCallback((field: string, value: string) => {
    if (typeof window === 'undefined' || !value.trim()) return;
    const history = readHistory();
    const existing = history[field] || [];
    const updated = [value, ...existing.filter((v) => v !== value)].slice(0, MAX_ITEMS);
    history[field] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, []);

  const saveMany = useCallback((fields: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    const history = readHistory();
    Object.entries(fields).forEach(([field, value]) => {
      if (!value?.trim()) return;
      const existing = history[field] || [];
      history[field] = [value, ...existing.filter((v) => v !== value)].slice(0, MAX_ITEMS);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, []);

  return { getSuggestions, saveValue, saveMany };
}
