import { randomBytes } from 'crypto';

/**
 * Generates a URL-safe random token using Node's built-in crypto module.
 * Avoids pulling in nanoid, whose modern releases are ESM-only and don't
 * play well with a CommonJS-compiled NestJS project.
 */
export function generateToken(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url');
}
