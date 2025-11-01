/**
 * Lintnotes
 * - Purpose: Normalize Google Sheets URLs to a CSV export URL that works across common formats.
 * - Exports: buildGoogleSheetCsvUrl(input)
 * - Notes: Derived from the robust logic used in web app; safe for mobile (no CORS).
 */

export function buildGoogleSheetCsvUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);

    // If not a Google Docs URL, assume it's already a CSV URL or compatible endpoint
    if (!url.host.includes('docs.google.com')) {
      return trimmed;
    }

    // Already a published CSV or export link
    if (
      url.pathname.includes('/pub') ||
      url.searchParams.get('output') === 'csv' ||
      trimmed.includes('output=csv')
    ) {
      return trimmed;
    }

    const pathSegments = url.pathname.split('/').filter(Boolean);
    let gid = url.searchParams.get('gid') || '';

    // Some links encode gid in the URL hash
    if (!gid && url.hash.includes('gid=')) {
      try {
        const hashParams = new URLSearchParams(url.hash.replace('#', ''));
        gid = hashParams.get('gid') || '';
      } catch {
        // ignore
      }
    }

    // Published link style: /spreadsheets/d/e/<docId>/... -> gviz CSV
    const dIndex = pathSegments.indexOf('d');
    const isPublishedLink = dIndex >= 0 && pathSegments[dIndex + 1] === 'e';
    if (isPublishedLink) {
      const docId = pathSegments[dIndex + 2];
      if (docId) {
        return `https://docs.google.com/spreadsheets/d/e/${docId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
      }
    }

    // Standard spreadsheet link: /spreadsheets/d/<sheetId>/edit#gid=... -> export CSV
    const spreadsheetIndex = pathSegments.indexOf('spreadsheets');
    if (spreadsheetIndex !== -1 && pathSegments[spreadsheetIndex + 1] === 'd') {
      const sheetId = pathSegments[spreadsheetIndex + 2];
      if (sheetId) {
        return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
      }
    }
  } catch {
    // Non-URL inputs fall through to raw
    return trimmed;
  }

  return trimmed;
}

