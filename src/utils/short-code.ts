import crypto from 'crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const BASE = CHARSET.length; // 36

/**
 * Generate a random short code using lowercase alphanumeric characters.
 * Default length: 7 characters = ~78 billion combinations (36^7)
 */
export function generateShortCode(length: number = 7): string {
  const randomBytes = crypto.randomBytes(length);
  let code = '';

  for (let i = 0; i < length; i++) {
    code += CHARSET[randomBytes[i] % BASE];
  }

  return code;
}

/**
 * Encode a number to Base62 string
 */
export function encodeBase62(num: number): string {
  if (num === 0) return CHARSET[0];

  let encoded = '';
  while (num > 0) {
    encoded = CHARSET[num % BASE] + encoded;
    num = Math.floor(num / BASE);
  }

  return encoded;
}

/**
 * Decode a Base62 string to number
 */
export function decodeBase62(str: string): number {
  let num = 0;

  for (let i = 0; i < str.length; i++) {
    const digit = CHARSET.indexOf(str[i]);
    if (digit === -1) {
      throw new Error(`Invalid character in Base62 string: ${str[i]}`);
    }
    num = num * BASE + digit;
  }

  return num;
}

/**
 * Validate short code format
 */
export function isValidShortCode(code: string): boolean {
  return /^[a-zA-Z0-9]{1,20}$/.test(code);
}
