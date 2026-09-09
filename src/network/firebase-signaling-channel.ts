import {
  closeSession,
  observeRemoteIceCandidates,
  observeSessionDescription,
  publishIceCandidate,
  publishSessionDescription,
} from './signaling';
import type { CoopRole } from './runtime-session';
import type { SignalMessage, SignalingChannel } from './webrtc-transport';

export function firebaseIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const username = import.meta.env.VITE_TURN_USERNAME;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && username && credential) {
    servers.push({ urls: turnUrl, username, credential });
  }
  return servers;
}

export function createFirebaseSignalingChannel(
  sessionId: string,
  role: CoopRole,
  remoteUid: string,
): SignalingChannel {
  const unsubscribers = new Set<() => void>();
  let closed = false;

  return {
    async publish(message: SignalMessage): Promise<void> {
      switch (message.type) {
        case 'offer':
        case 'answer':
          if (!message.description.sdp) {
            throw new Error('WebRTC description did not include SDP.');
          }
          await publishSessionDescription(sessionId, {
            type: message.type,
            sdp: message.description.sdp,
          });
          return;
        case 'candidate':
          await publishIceCandidate(sessionId, {
            candidate: message.candidate.candidate ?? '',
            sdpMid: message.candidate.sdpMid ?? null,
            sdpMLineIndex: message.candidate.sdpMLineIndex ?? null,
            usernameFragment: message.candidate.usernameFragment ?? null,
          });
          return;
        default: {
          const neverMessage: never = message;
          return neverMessage;
        }
      }
    },

    subscribe(listener: (message: SignalMessage) => void): () => void {
      const remoteDescriptionType = role === 'host' ? 'answer' : 'offer';
      const stopDescription = observeSessionDescription(
        sessionId,
        remoteDescriptionType,
        (description) => listener({
          type: remoteDescriptionType,
          description: { type: description.type, sdp: description.sdp },
        }),
      );
      const stopCandidates = observeRemoteIceCandidates(
        sessionId,
        remoteUid,
        (candidate) => listener({ type: 'candidate', candidate }),
      );
      unsubscribers.add(stopDescription);
      unsubscribers.add(stopCandidates);
      return () => {
        stopDescription();
        stopCandidates();
        unsubscribers.delete(stopDescription);
        unsubscribers.delete(stopCandidates);
      };
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers.clear();
      try {
        await closeSession(sessionId);
      } catch {
        // The other peer may have already closed the shared session.
      }
    },
  };
}
