/**
 * CSV Export utility
 */

export interface CSVExportOptions {
  filename?: string;
  headers?: string[];
}

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) return '';

  // Get headers from first object if not provided
  const actualHeaders = headers || Object.keys(data[0]);

  // CSV header row
  const headerRow = actualHeaders
    .map(h => `"${String(h).replace(/"/g, '""')}"`)
    .join(',');

  // CSV data rows
  const dataRows = data.map(row =>
    actualHeaders
      .map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(
  data: Record<string, any>[],
  filename: string = 'export.csv',
  headers?: string[]
): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format analytics data for CSV export
 */
export function formatAnalyticsForExport(data: any): Record<string, any>[] {
  if (Array.isArray(data)) {
    return data.map(item => formatAnalyticsItem(item));
  }
  return [formatAnalyticsItem(data)];
}

function formatAnalyticsItem(item: any): Record<string, any> {
  return {
    'Short Code': item.shortCode || item.name || '-',
    'Campaign': item.campaign || item.campaignName || '-',
    'Clicks': item.clicks || item.totalClicks || 0,
    'Conversions': item.conversions || item.totalConversions || 0,
    'Conversion Rate (%)': item.conversionRate
      ? (item.conversionRate as number).toFixed(2)
      : '0.00',
    'Deferred Match Rate (%)': item.deferredMatchRate
      ? (item.deferredMatchRate as number).toFixed(2)
      : '0.00',
    'Status': item.status || 'active',
    'Created At': item.createdAt
      ? new Date(item.createdAt).toLocaleDateString()
      : '-',
    'Last Clicked': item.lastClicked
      ? new Date(item.lastClicked).toLocaleDateString()
      : '-',
  };
}

/**
 * Format date range for filename
 */
export function formatDateRangeForFilename(
  startDate?: Date,
  endDate?: Date
): string {
  if (!startDate || !endDate) {
    return new Date().toISOString().split('T')[0];
  }

  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];
  return `${start}_to_${end}`;
}

/**
 * Create properly formatted analytics CSV filename
 */
export function getAnalyticsFilename(
  type: 'analytics' | 'links' | 'campaigns' = 'analytics',
  startDate?: Date,
  endDate?: Date
): string {
  const dateRange = formatDateRangeForFilename(startDate, endDate);
  return `AE-LINK_${type}_${dateRange}.csv`;
}
