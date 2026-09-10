import { parseRuntimeMessage, type RuntimeMessage } from './protocol';
import type { CoopRole, RuntimeTransport } from './runtime-session';

export type SignalMessage =
  | { type: 'offer'; description: RTCSessionDescriptionInit }
  | { type: 'answer'; description: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

export interface SignalingChannel {
  publish(message: SignalMessage): Promise<void>;
  subscribe(listener: (message: SignalMessage) => void): () => void;
  close(): Promise<void>;
}

export interface WebRtcConnectOptions {
  role: CoopRole;
  signaling: SignalingChannel;
  iceServers: RTCIceServer[];
  timeoutMs?: number;
}

function decodeRuntimeMessage(raw: string): RuntimeMessage | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseRuntimeMessage(parsed) ?? undefined;
  } catch {
    return undefined;
  }
}

export class WebRtcRuntimeTransport implements RuntimeTransport {
  private readonly listeners = new Set<(message: RuntimeMessage) => void>();
  private readonly stopSignaling: () => void;
  private events?: RTCDataChannel;
  private state?: RTCDataChannel;
  private closed = false;
  private disconnectTimer?: number;

  private constructor(
    private readonly peer: RTCPeerConnection,
    private readonly signaling: SignalingChannel,
    stopSignaling: () => void,
  ) {
    this.stopSignaling = stopSignaling;
    this.peer.onconnectionstatechange = () => this.handleConnectionState();
  }

  static async connect(options: WebRtcConnectOptions): Promise<WebRtcRuntimeTransport> {
    const peer = new RTCPeerConnection({ iceServers: options.iceServers });
    let transport!: WebRtcRuntimeTransport;
    const queuedCandidates: RTCIceCandidateInit[] = [];

    const applySignal = async (message: SignalMessage): Promise<void> => {
      switch (message.type) {
        case 'offer':
          if (options.role !== 'guest') {
            return;
          }
          await peer.setRemoteDescription(message.description);
          for (const candidate of queuedCandidates.splice(0)) {
            await peer.addIceCandidate(candidate);
          }
          await peer.setLocalDescription(await peer.createAnswer());
          if (peer.localDescription) {
            await options.signaling.publish({ type: 'answer', description: peer.localDescription.toJSON() });
          }
          return;
        case 'answer':
          if (options.role !== 'host') {
            return;
          }
          await peer.setRemoteDescription(message.description);
          for (const candidate of queuedCandidates.splice(0)) {
            await peer.addIceCandidate(candidate);
          }
          return;
        case 'candidate':
          if (!peer.remoteDescription) {
            queuedCandidates.push(message.candidate);
            return;
          }
          await peer.addIceCandidate(message.candidate);
          return;
        default: {
          const neverMessage: never = message;
          return neverMessage;
        }
      }
    };

    const stopSignaling = options.signaling.subscribe((message) => {
      void applySignal(message);
    });
    transport = new WebRtcRuntimeTransport(peer, options.signaling, stopSignaling);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void options.signaling.publish({ type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };
    peer.ondatachannel = (event) => transport.attachChannel(event.channel);

    if (options.role === 'host') {
      transport.attachChannel(peer.createDataChannel('events', { ordered: true }));
      transport.attachChannel(peer.createDataChannel('state', { ordered: false, maxRetransmits: 0 }));
      await peer.setLocalDescription(await peer.createOffer());
      if (peer.localDescription) {
        await options.signaling.publish({ type: 'offer', description: peer.localDescription.toJSON() });
      }
    }

    await transport.waitUntilOpen(options.timeoutMs ?? 15_000);
    return transport;
  }

  get connected(): boolean {
    return !this.closed && this.events?.readyState === 'open' && this.state?.readyState === 'open';
  }

  send(message: RuntimeMessage): void {
    const channel = message.type === 'input' || message.type === 'snapshot' ? this.state : this.events;
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  }

  subscribe(listener: (message: RuntimeMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.disconnectTimer !== undefined) {
      window.clearTimeout(this.disconnectTimer);
    }
    this.stopSignaling();
    this.events?.close();
    this.state?.close();
    this.peer.close();
    void this.signaling.close();
    this.listeners.clear();
  }

  private handleConnectionState(): void {
    if (this.closed) {
      return;
    }
    switch (this.peer.connectionState) {
      case 'connected':
        if (this.disconnectTimer !== undefined) {
          window.clearTimeout(this.disconnectTimer);
          this.disconnectTimer = undefined;
        }
        return;
      case 'disconnected':
        if (this.disconnectTimer === undefined) {
          this.disconnectTimer = window.setTimeout(() => {
            this.disconnectTimer = undefined;
            this.emitDisconnect('connection-lost');
          }, 4000);
        }
        return;
      case 'failed':
      case 'closed':
        this.emitDisconnect('connection-lost');
        return;
      case 'new':
      case 'connecting':
        return;
      default: {
        const neverState: never = this.peer.connectionState;
        return neverState;
      }
    }
  }

  private emitDisconnect(reason: string): void {
    if (this.closed) {
      return;
    }
    const message: RuntimeMessage = { type: 'leave', reason };
    this.listeners.forEach((listener) => listener(message));
    this.close();
  }

  private attachChannel(channel: RTCDataChannel): void {
    if (channel.label === 'events') {
      this.events = channel;
    } else if (channel.label === 'state') {
      this.state = channel;
    } else {
      channel.close();
      return;
    }
    channel.onmessage = (event: MessageEvent<string>) => {
      const message = decodeRuntimeMessage(event.data);
      if (message) {
        this.listeners.forEach((listener) => listener(message));
      }
    };
  }

  private waitUntilOpen(timeoutMs: number): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Timed out while connecting to teammate.'));
      }, timeoutMs);
      const poll = window.setInterval(() => {
        if (!this.connected) {
          return;
        }
        cleanup();
        resolve();
      }, 25);
      const cleanup = (): void => {
        window.clearTimeout(timeout);
        window.clearInterval(poll);
      };
    });
  }
}
