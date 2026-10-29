import { getDatabase } from '../db/database.js';

export interface Webhook {
  id: number;
  url: string;
  secret?: string;
  event_types: string;
  is_active: number;
  created_at: string;
}

export class WebhookService {
  public registerWebhook(url: string, secret?: string, eventTypes = '*'): Webhook {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO webhooks (url, secret, event_types, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `);
    const info = stmt.run(url.trim(), secret || null, eventTypes, now);
    return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(info.lastInsertRowid) as Webhook;
  }

  public listWebhooks(): Webhook[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM webhooks WHERE is_active = 1').all() as Webhook[];
  }

  public async dispatchEvent(eventType: string, payload: any): Promise<number> {
    const hooks = this.listWebhooks();
    let sent = 0;
    for (const hook of hooks) {
      if (hook.event_types === '*' || hook.event_types.split(',').includes(eventType)) {
        try {
          fetch(hook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Event-Type': eventType },
            body: JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() }),
          }).catch(() => {});
          sent++;
        } catch (_) {}
      }
    }
    return sent;
  }
}

export const webhookService = new WebhookService();
