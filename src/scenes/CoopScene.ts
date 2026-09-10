import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type LevelId } from '../config';
import { cycleUnlockedLevel, loadSave, resetSessionLives, resumeLevelId } from '../data/progress';
import { applySettings } from '../data/settings';
import {
  ensureAnonymousIdentity,
  inviteFriend,
  observeFriends,
  observeIncomingFriendRequests,
  observeInvitations,
  observePresence,
  observeSession,
  respondToFriendRequest,
  respondToInvitation,
  sendFriendRequest,
  setSessionConnected,
  startPresence,
  type CoopSession,
  type Friend,
  type FriendRequest,
  type GameInvitation,
  type PresenceHandle,
  type SocialIdentity,
} from '../network';
import { createFirebaseSignalingChannel, firebaseIceServers } from '../network/firebase-signaling-channel';
import { setActiveCoopSession, type CoopRole } from '../network/runtime-session';
import { WebRtcRuntimeTransport } from '../network/webrtc-transport';
import { audio } from '../systems/audio';
import { addPanel, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';

export class CoopScene extends Phaser.Scene {
  private identity?: SocialIdentity;
  private friends: readonly Friend[] = [];
  private requests: readonly FriendRequest[] = [];
  private invitations: readonly GameInvitation[] = [];
  private selectedLevel: LevelId = '1-1';
  private status = 'CONNECTING TO FRIENDS…';
  private connecting = false;
  private handledSessionId?: string;
  private presence?: PresenceHandle;
  private readonly online = new Map<string, boolean>();
  private readonly unsubscribers = new Set<() => void>();
  private readonly presenceUnsubscribers = new Set<() => void>();
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private nav?: MenuNav;
  private levelButton?: MenuButton;
  private inviteButtons: Array<{ button: MenuButton; online: boolean }> = [];

  constructor() {
    super('CoopScene');
  }

  create(): void {
    applySettings(this);
    audio.playTheme(this, 'grass');
    this.cameras.main.setBackgroundColor(0x101820);
    const save = loadSave();
    this.selectedLevel = resumeLevelId(save);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x101820).setOrigin(0);
    this.add
      .text(GAME_WIDTH / 2, 48, 'ONLINE CO-OP', {
        ...textStyle('42px', '#ffffff'),
        stroke: '#7a1212',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    addPanel(this, GAME_WIDTH / 2, 390, 1040, 570);
    this.render();
    void this.initialize();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private async initialize(): Promise<void> {
    try {
      this.identity = await ensureAnonymousIdentity();
      this.presence = await startPresence(this.identity.uid);
      this.status = 'Choose a friend to invite.';
      this.observeSocialState();
      this.render();
    } catch (error) {
      this.status = this.errorMessage(error);
      this.render();
    }
  }

  private observeSocialState(): void {
    const identity = this.identity;
    if (!identity) {
      return;
    }
    this.unsubscribers.add(observeFriends(identity.uid, (friends) => {
      this.friends = friends;
      this.refreshFriendPresence();
      this.render();
    }, (error) => this.showError(error)));
    this.unsubscribers.add(observeIncomingFriendRequests(identity.uid, (requests) => {
      this.requests = requests;
      this.render();
    }, (error) => this.showError(error)));
    this.unsubscribers.add(observeInvitations(identity.uid, (invitations) => {
      this.invitations = invitations;
      this.render();
      const accepted = invitations.find((invitation) => (
        invitation.status === 'accepted' &&
        invitation.fromUid === identity.uid &&
        invitation.sessionId &&
        (invitation.expiresAtMs ?? 0) > Date.now() &&
        invitation.sessionId !== this.handledSessionId
      ));
      if (accepted?.sessionId) {
        this.waitForSession(accepted.sessionId, 'host');
      }
    }, (error) => this.showError(error)));
  }

  private refreshFriendPresence(): void {
    this.presenceUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.presenceUnsubscribers.clear();
    for (const friend of this.friends) {
      const unsubscribe = observePresence(friend.profile.uid, (presence) => {
        this.online.set(friend.profile.uid, presence.online);
        this.render();
      });
      this.presenceUnsubscribers.add(unsubscribe);
    }
  }

  private render(): void {
    this.nav?.destroy();
    this.nav = undefined;
    this.levelButton = undefined;
    this.inviteButtons = [];
    this.dynamic.forEach((object) => object.destroy());
    this.dynamic = [];
    const buttons: MenuButton[] = [];
    const addText = (
      x: number,
      y: number,
      value: string,
      size = '18px',
      color: string = UI.text,
    ): Phaser.GameObjects.Text => {
      const text = this.add.text(x, y, value, textStyle(size, color)).setOrigin(0.5).setDepth(80);
      this.dynamic.push(text);
      return text;
    };
    const addButton = (
      x: number,
      y: number,
      label: string,
      action: () => void,
      width = 310,
      height = 46,
    ): MenuButton => {
      const button = new MenuButton(this, x, y, label, action, width, height);
      this.dynamic.push(button);
      buttons.push(button);
      return button;
    };

    addText(GAME_WIDTH / 2, 126, this.status, '18px', this.connecting ? UI.gold : UI.muted);
    if (this.identity) {
      addText(350, 175, `FRIEND CODE  ${this.identity.friendCode}`, '22px', UI.gold);
      addButton(590, 175, 'COPY CODE', () => void this.copyFriendCode(), 180);
      addButton(800, 175, 'ADD FRIEND', () => void this.addFriend(), 200);
    }

    const previousLevel = addButton(188, 236, '◀', () => this.cycleHostLevel(-1), 72);
    this.levelButton = addButton(430, 236, this.hostLevelLabel(), () => this.cycleHostLevel(1), 360);
    const nextLevel = addButton(672, 236, '▶', () => this.cycleHostLevel(1), 72);
    const adjustHostLevel = (direction: -1 | 1): void => this.cycleHostLevel(direction, true);
    previousLevel.onAdjust = adjustHostLevel;
    this.levelButton.onAdjust = adjustHostLevel;
    nextLevel.onAdjust = adjustHostLevel;
    addText(900, 236, 'TAP OR ← →', '16px', UI.muted);

    let y = 294;
    const request = this.requests[0];
    if (request) {
      addText(390, y, `${request.senderDisplayName} sent a friend request`, '18px');
      addButton(700, y, 'ACCEPT FRIEND', () => void this.answerFriendRequest(request.id, 'accept'), 230);
      addButton(930, y, 'DECLINE', () => void this.answerFriendRequest(request.id, 'decline'), 180);
      y += 54;
    }
    const incoming = this.invitations.find((invitation) => (
      invitation.status === 'pending' && invitation.toUid === this.identity?.uid
    ));
    if (incoming) {
      const inviter = this.friends.find((friend) => friend.profile.uid === incoming.fromUid);
      addText(380, y, `${inviter?.profile.displayName ?? 'A friend'} invited you to ${incoming.levelId}`, '18px');
      addButton(700, y, 'JOIN GAME', () => void this.answerInvitation(incoming, 'accept'), 230);
      addButton(930, y, 'DECLINE', () => void this.answerInvitation(incoming, 'decline'), 180);
      y += 54;
    }

    addText(GAME_WIDTH / 2, y + 4, 'FRIENDS', '20px', UI.gold);
    y += 44;
    if (this.friends.length === 0) {
      addText(GAME_WIDTH / 2, y, 'Add a friend with their 8-character code.', '18px', UI.muted);
      y += 48;
    } else {
      for (const friend of this.friends.slice(0, 5)) {
        const isOnline = this.online.get(friend.profile.uid) === true;
        addText(410, y, `${friend.profile.displayName}  ·  ${isOnline ? 'ONLINE' : 'OFFLINE'}`, '18px', isOnline ? '#9be36e' : UI.muted);
        const invite = addButton(
          800,
          y,
          this.inviteLabel(isOnline),
          () => void this.sendInvitation(friend),
          320,
        );
        this.inviteButtons.push({ button: invite, online: isOnline });
        if (!isOnline || this.connecting) {
          invite.disableInteractive();
          invite.setTone('muted');
        }
        y += 52;
      }
    }
    addButton(GAME_WIDTH / 2, 656, 'BACK', () => this.scene.start('TitleScene'), 240);
    this.nav = new MenuNav(this, buttons, () => this.scene.start('TitleScene'));
    this.nav.setEnabled(!this.connecting);
  }

  private hostLevelLabel(): string {
    return `HOST LEVEL  ${this.selectedLevel}`;
  }

  private inviteLabel(online: boolean): string {
    return online ? `INVITE TO ${this.selectedLevel}` : 'OFFLINE';
  }

  private cycleHostLevel(direction: -1 | 1, playMoveSound = false): void {
    if (this.connecting) {
      return;
    }
    const next = cycleUnlockedLevel(this.selectedLevel, loadSave().unlocked, direction);
    if (next === this.selectedLevel) {
      return;
    }
    this.selectedLevel = next;
    this.applySelectedLevel();
    if (playMoveSound) {
      audio.play(this, 'map');
    }
  }

  private applySelectedLevel(): void {
    this.levelButton?.setLabel(this.hostLevelLabel());
    for (const { button, online } of this.inviteButtons) {
      button.setLabel(this.inviteLabel(online));
    }
  }

  private async copyFriendCode(): Promise<void> {
    if (!this.identity) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.identity.friendCode);
      this.status = 'Friend code copied.';
    } catch {
      this.status = `Friend code: ${this.identity.friendCode}`;
    }
    this.render();
  }

  private async addFriend(): Promise<void> {
    const code = window.prompt('Enter your friend’s 8-character code:');
    if (!code) {
      return;
    }
    try {
      await sendFriendRequest(code);
      this.status = 'Friend request sent.';
    } catch (error) {
      this.status = this.errorMessage(error);
    }
    this.render();
  }

  private async answerFriendRequest(id: string, response: 'accept' | 'decline'): Promise<void> {
    try {
      await respondToFriendRequest(id, response);
      this.status = response === 'accept' ? 'Friend added.' : 'Friend request declined.';
    } catch (error) {
      this.status = this.errorMessage(error);
    }
    this.render();
  }

  private async sendInvitation(friend: Friend): Promise<void> {
    try {
      await inviteFriend(friend.profile.uid, this.selectedLevel);
      this.status = `Invite sent to ${friend.profile.displayName}.`;
    } catch (error) {
      this.status = this.errorMessage(error);
    }
    this.render();
  }

  private async answerInvitation(
    invitation: GameInvitation,
    response: 'accept' | 'decline',
  ): Promise<void> {
    try {
      const session = await respondToInvitation(invitation.id, response);
      if (session) {
        await this.connectSession(session, 'guest');
        return;
      }
      this.status = response === 'decline' ? 'Invitation declined.' : 'Invitation expired.';
    } catch (error) {
      this.status = this.errorMessage(error);
    }
    this.render();
  }

  private waitForSession(sessionId: string, role: CoopRole): void {
    this.handledSessionId = sessionId;
    const stop = observeSession(sessionId, (session) => {
      if (!session) {
        return;
      }
      stop();
      this.unsubscribers.delete(stop);
      void this.connectSession(session, role);
    }, (error) => this.showError(error));
    this.unsubscribers.add(stop);
  }

  private async connectSession(session: CoopSession, role: CoopRole): Promise<void> {
    if (this.connecting || !this.identity) {
      return;
    }
    this.connecting = true;
    this.status = 'CONNECTING TO TEAMMATE…';
    this.render();
    const remoteUid = role === 'host' ? session.guestUid : session.hostUid;
    try {
      const transport = await WebRtcRuntimeTransport.connect({
        role,
        signaling: createFirebaseSignalingChannel(session.id, role, remoteUid),
        iceServers: firebaseIceServers(),
      });
      try {
        await setSessionConnected(session.id);
      } catch {
        // The other peer may have completed this shared transition first.
      }
      const remoteName = this.friends.find((friend) => friend.profile.uid === remoteUid)?.profile.displayName ?? 'Teammate';
      const link = {
        role,
        levelId: session.levelId,
        localPlayerId: this.identity.uid,
        remotePlayerId: remoteUid,
        localName: this.identity.displayName,
        remoteName,
        transport,
      };
      setActiveCoopSession(link);
      resetSessionLives();
      this.scene.start('PlayScene', {
        levelId: session.levelId,
        session: link,
        skipControlsHint: true,
      });
    } catch (error) {
      this.connecting = false;
      this.status = this.errorMessage(error);
      this.render();
    }
  }

  private showError(error: Error): void {
    this.status = this.errorMessage(error);
    this.render();
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.length > 100 ? `${message.slice(0, 97)}…` : message;
  }

  private cleanup(): void {
    this.nav?.destroy();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers.clear();
    this.presenceUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.presenceUnsubscribers.clear();
    void this.presence?.stop();
    this.presence = undefined;
  }
}
