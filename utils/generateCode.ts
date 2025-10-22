/**
 * Lintnotes
 * - Purpose: Generate random alphanumeric codes safe for iOS, Android, and web using expo-crypto.
 * - Exports: generateCode function
 * - Major deps: expo-crypto
 * - Side effects: None. Uses secure random bytes from expo-crypto.
 */
import * as Crypto from 'expo-crypto';

/**
 * Generates a random alphanumeric code safe for iOS, Android, and web.
 * Uses expo-crypto instead of Node's crypto API for React Native compatibility.
 * 
 * @param length - Length of the code to generate (default: 6)
 * @returns A random uppercase alphanumeric string (e.g., "Q2X91A")
 * 
 * @example
 * const code = generateCode(6); // "A3X7K9"
 */
export function generateCode(length = 6): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = Crypto.getRandomBytes(length);
  
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join('');
}

