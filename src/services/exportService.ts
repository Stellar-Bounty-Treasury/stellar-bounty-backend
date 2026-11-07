import { getDatabase } from '../db/database.js';

function sanitizeCsvCell(val: any): string {
  let str = (val === null || val === undefined ? '' : String(val)).trim();
  // Prevent CSV / Spreadsheet Formula Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export class ExportService {
  public generateBountiesCsv(): string {
    const db = getDatabase();
    const rows = db.prepare('SELECT id, title, creator_address, target_amount, funded_amount, status, created_at FROM bounties ORDER BY id DESC').all() as any[];

    const headers = ['ID', 'Title', 'Creator Address', 'Target Amount (XLM)', 'Funded Amount (XLM)', 'Status', 'Created At'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      lines.push([
        r.id,
        sanitizeCsvCell(r.title),
        sanitizeCsvCell(r.creator_address),
        r.target_amount,
        r.funded_amount,
        sanitizeCsvCell(r.status),
        sanitizeCsvCell(r.created_at),
      ].join(','));
    }

    return lines.join('\n');
  }
}

export const exportService = new ExportService();
