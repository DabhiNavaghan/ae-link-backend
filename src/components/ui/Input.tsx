'use client';

import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'text' | 'email' | 'url' | 'number' | 'search';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, variant = 'text', className = '', ...props },
    ref
  ) => {
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
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={typeMap[variant]}
          className={inputClasses}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-danger-600 font-medium">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-sm text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
