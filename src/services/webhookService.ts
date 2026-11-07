import crypto from 'crypto';
import { getDatabase } from '../db/database.js';

export interface Webhook {
  id: number;
  url: string;
  secret?: string;
  event_types: string;
  is_active: number;
  created_at: string;
}

export function validateWebhookUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid webhook URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use http or https protocol.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Localhost and loopback webhook URLs are prohibited.');
  }

  if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) {
    throw new Error('Link-local and cloud metadata endpoints are prohibited.');
  }

  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const a = Number(ipMatch[1]);
    const b = Number(ipMatch[2]);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || a === 0) {
      throw new Error('Private network IP addresses are prohibited for webhooks.');
    }
  }

  return parsed.toString();
}

export class WebhookService {
  public registerWebhook(url: string, secret?: string, eventTypes = '*'): Webhook {
    const validatedUrl = validateWebhookUrl(url);
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO webhooks (url, secret, event_types, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `);
    const info = stmt.run(validatedUrl, secret || null, eventTypes, now);
    return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(info.lastInsertRowid) as Webhook;
  }

  public listWebhooks(): Webhook[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM webhooks WHERE is_active = 1').all() as Webhook[];
  }

  public async dispatchEvent(eventType: string, payload: any): Promise<number> {
    const hooks = this.listWebhooks();
    let sent = 0;
    const bodyStr = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    for (const hook of hooks) {
      if (hook.event_types === '*' || hook.event_types.split(',').includes(eventType)) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Event-Type': eventType,
          };

          if (hook.secret) {
            const hmac = crypto.createHmac('sha256', hook.secret).update(bodyStr).digest('hex');
            headers['X-Hub-Signature-256'] = `sha256=${hmac}`;
          }

          fetch(hook.url, {
            method: 'POST',
            headers,
            body: bodyStr,
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
          sent++;
        } catch (_) {}
      }
    }
    return sent;
  }
}

export const webhookService = new WebhookService();
