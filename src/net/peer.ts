import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { ClientMsg, ServerMsg } from '../shared/protocol';
import type { Channel } from './channel';

// Playing with friends without a game server. The host's tab runs the room;
// everyone else's tab connects straight to it over WebRTC. A public broker
// (the PeerJS cloud) is used only to introduce the tabs to each other: it
// sees the room code, never the game.

const PREFIX = 'bubaran-golf-';
/** No 0/O or 1/I: codes get read out loud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

/** Tidy what someone typed or pasted into a room code. */
export function cleanCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

/** One end of a channel over a data connection. Messages travel as JSON text. */
function wrap<Out, In>(conn: DataConnection): Channel<Out, In> {
  let handler: ((msg: In) => void) | null = null;
  let closeHandler: (() => void) | null = null;
  const backlog: In[] = [];
  let open = true;

  conn.on('data', (data) => {
    let msg: In;
    try {
      msg = JSON.parse(String(data)) as In;
    } catch {
      return; // not ours
    }
    if (handler) handler(msg);
    else backlog.push(msg);
  });
  const closed = () => {
    if (!open) return;
    open = false;
    closeHandler?.();
  };
  conn.on('close', closed);
  conn.on('error', closed);
  // A tab that is closed or loses its network may never say goodbye.
  conn.on('iceStateChanged', (state) => {
    if (state === 'disconnected' || state === 'failed' || state === 'closed') closed();
  });

  return {
    send(msg: Out) {
      if (open && conn.open) conn.send(JSON.stringify(msg));
    },
    onMessage(cb) {
      handler = cb;
      for (const m of backlog.splice(0)) cb(m);
    },
    onClose(cb) {
      closeHandler = cb;
    },
    close() {
      closed();
      conn.close();
    },
  };
}

/**
 * Open a room under this code. onGuest is called with a channel for each
 * friend who connects. Resolves once the room can be joined.
 */
export function hostRoom(code: string, onGuest: (ch: Channel<ServerMsg, ClientMsg>) => void): Promise<{ close(): void }> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PREFIX + code);
    peer.on('open', () => resolve({ close: () => peer.destroy() }));
    peer.on('error', (err) => reject(new Error(err.type === 'unavailable-id' ? 'That room code is taken. Try again.' : 'Could not open a room. Check your connection.')));
    peer.on('connection', (conn) => {
      conn.on('open', () => onGuest(wrap<ServerMsg, ClientMsg>(conn)));
    });
    // The broker link can drop while the room carries on; ask for it back so late joiners still find us.
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
  });
}

/** Connect to the room with this code. Resolves with a channel to its host. */
export function joinRoom(code: string): Promise<Channel<ClientMsg, ServerMsg>> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    const fail = (why: string) => {
      peer.destroy();
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail('No answer from that room.'), 15000);
    peer.on('error', (err) => {
      clearTimeout(timer);
      fail(err.type === 'peer-unavailable' ? 'There is no room with that code.' : 'Could not reach the room. Check your connection.');
    });
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => {
        clearTimeout(timer);
        resolve(wrap<ClientMsg, ServerMsg>(conn));
      });
    });
  });
}
