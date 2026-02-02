/**
 * Lintnotes
 * - Purpose: Generate QR codes and deep links for event access codes.
 * - Exports: generateAccessCodeLink, QRCodeDisplay (component)
 * - Major deps: expo-linking for URL scheme
 * - Side effects: None
 */
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { formatCodeForDisplay } from './codeManagement';

const APP_SCHEME = 'checkin';

export function generateAccessCodeLink(code: string, eventId: string): string {
  const normalizedCode = code.toUpperCase().replace(/[\s-]+/g, '');

  const rawScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(rawScheme) ? rawScheme[0] : (rawScheme ?? APP_SCHEME);

  return Linking.createURL('redeem', {
    scheme,
    queryParams: {
      code: normalizedCode,
      event: eventId,
    },
  });
}

export function generateWebLink(code: string, eventId: string): string | null {
  const normalizedCode = code.toUpperCase().replace(/[\s-]+/g, '');

  const baseUrl = Constants.expoConfig?.extra?.webUrl
    ?? process.env.EXPO_PUBLIC_REDIRECT_URL;

  if (!baseUrl) {
    return null;
  }

  const url = new URL('/redeem', baseUrl);
  url.searchParams.set('code', normalizedCode);
  url.searchParams.set('event', eventId);

  return url.toString();
}

export function parseCodeFromUrl(url: string): { code: string | null; eventId: string | null } {
  try {
    const parsed = Linking.parse(url);

    const code = parsed.queryParams?.code as string | undefined;
    const eventId = parsed.queryParams?.event as string | undefined;

    return {
      code: code ?? null,
      eventId: eventId ?? null,
    };
  } catch {
    return { code: null, eventId: null };
  }
}

export function getShareMessage(code: string, eventId: string, eventName?: string): string {
  const displayCode = formatCodeForDisplay(code);
  const link = generateAccessCodeLink(code, eventId);

  const eventLabel = eventName ? `"${eventName}"` : 'the event';

  return `You've been invited to check in attendees for ${eventLabel}.\n\nAccess Code: ${displayCode}\n\nOpen this link to get started:\n${link}`;
}
