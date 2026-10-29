import { getDatabase } from '../db/database.js';

export interface AuditLogEntry {
  action_type: string;
  actor_address: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
}

export class AuditService {
  public log(entry: AuditLogEntry): void {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO audit_logs (action_type, actor_address, resource_id, details_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entry.action_type,
        entry.actor_address,
        entry.resource_id || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address || null,
        now
      );
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  }

  public listLogs(limit = 50): any[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
  }
}

export const auditService = new AuditService();
