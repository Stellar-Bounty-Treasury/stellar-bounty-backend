import { getDatabase } from '../db/database.js';

export class ExportService {
  public generateBountiesCsv(): string {
    const db = getDatabase();
    const rows = db.prepare('SELECT id, title, creator_address, target_amount, funded_amount, status, created_at FROM bounties ORDER BY id DESC').all() as any[];

    const headers = ['ID', 'Title', 'Creator Address', 'Target Amount (XLM)', 'Funded Amount (XLM)', 'Status', 'Created At'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      lines.push([
        r.id,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.creator_address,
        r.target_amount,
        r.funded_amount,
        r.status,
        r.created_at,
      ].join(','));
    }

    return lines.join('\n');
  }
}

export const exportService = new ExportService();
