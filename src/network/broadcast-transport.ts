import { parseRuntimeMessage, type RuntimeMessage } from './protocol';
import type { RuntimeTransport } from './runtime-session';

export class BroadcastRuntimeTransport implements RuntimeTransport {
  private readonly channel: BroadcastChannel;
  private readonly listeners = new Set<(message: RuntimeMessage) => void>();
  private open = true;

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseRuntimeMessage(event.data);
      if (message) {
        this.listeners.forEach((listener) => listener(message));
      }
    };
  }

  get connected(): boolean {
    return this.open;
  }

  send(message: RuntimeMessage): void {
    if (this.open) {
      this.channel.postMessage(message);
    }
  }

  subscribe(listener: (message: RuntimeMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.channel.close();
    this.listeners.clear();
  }
}
