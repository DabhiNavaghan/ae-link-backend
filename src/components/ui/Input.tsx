'use client';

import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'text' | 'email' | 'url' | 'number' | 'search';
  suggestions?: string[];
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, variant = 'text', className = '', suggestions, ...props },
    ref
  ) => {
    const listId = useId();
    const inputClasses = `input-base ${error ? 'border-danger-500 ring-danger-500' : ''} ${className}`.trim();

    const typeMap: Record<string, string> = {
      text: 'text',
      email: 'email',
      url: 'url',
      number: 'number',
      search: 'search',
    };

    return (
      <div className="w-full">
        {label && (
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={typeMap[variant]}
          className={inputClasses}
          list={suggestions && suggestions.length > 0 ? listId : undefined}
          {...props}
        />
        {suggestions && suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {error && (
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: 'var(--color-danger)' }}
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
