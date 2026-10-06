import { Response } from 'express';

export interface RealtimeEvent {
  id?: string;
  type: string;
  timestamp: string;
  data: any;
}

export class RealtimeService {
  private clients: Set<Response> = new Set();

  /**
   * Register a new SSE client connection
   */
  public addClient(res: Response): void {
    this.clients.add(res);

    // Initial connection greeting
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Stellar Bounty Treasury realtime event stream', timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcast an event to all connected SSE clients
   */
  public broadcast(type: string, data: any): void {
    const payload: RealtimeEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Number of active client connections
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeService = new RealtimeService();
