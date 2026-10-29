export type EventCallback = (event: { type: string; data: any; timestamp: string }) => void;

export class SdkEventStream {
  private sseUrl: string;
  private listeners: EventCallback[] = [];

  constructor(baseUrl: string) {
    this.sseUrl = baseUrl.replace(/\/+$/, '') + '/api/events/stream';
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public emitSyntheticEvent(type: string, data: any): void {
    const payload = { type, data, timestamp: new Date().toISOString() };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
