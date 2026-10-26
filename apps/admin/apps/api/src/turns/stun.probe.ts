import { randomBytes } from 'node:crypto';
import { createSocket } from 'node:dgram';

export interface StunProbeResult {
  ok: boolean;
  latencyMs: number;
  errorText: string | null;
  /** The server-reflexive address the STUN reply names, when readable. */
  mappedAddress: { ip: string; port: number } | null;
}

const MAGIC_COOKIE = 0x2112a442;
/** Binding Request method (RFC 5389). */
const BINDING_REQUEST = 0x0001;
/** Binding Success response type. */
export const STUN_BINDING_SUCCESS = 0x0101;
/** XOR-MAPPED-ADDRESS attribute type. */
const ATTR_XOR_MAPPED = 0x0020;

/**
 * One STUN binding round trip.
 *
 * A TURN server is an application on top of a UDP listener: a TCP "can I
 * connect" check says nothing about the relay path. This probe sends a real
 * Binding Request and times the Binding Response, so *online* means the UDP
 * path reached the STUN service and answered within the timeout — not merely
 * that a socket accepted packets.
 *
 * Lone and allocation-light: it runs from a cron at 5-minute intervals.
 */
export function stunProbe(input: {
  host: string;
  port: number;
  timeoutMs: number;
  /** Present when the caller parsed a turn:/turns: URL; context only. */
  url?: string;
}): Promise<StunProbeResult> {
  void input.url;

  return new Promise<StunProbeResult>((resolve) => {
    const socket = createSocket('udp4');
    let settled = false;
    const started = Date.now();
    const txid = randomBytes(12);

    const finish = (
      ok: boolean,
      errorText: string | null,
      mappedAddress?: StunProbeResult['mappedAddress'],
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve({
        ok,
        latencyMs: Date.now() - started,
        errorText,
        mappedAddress: mappedAddress ?? null,
      });
    };

    const timer = setTimeout(() => finish(false, 'timeout'), input.timeoutMs);

    socket.on('message', (msg: Buffer) => {
      const type = msg.readUInt16BE(0);
      if (type !== STUN_BINDING_SUCCESS) {
        finish(false, `unexpected STUN message type ${type}`);
        return;
      }
      // The response must echo the transaction id — the identity proof that
      // *someone* answering is the server we asked.
      if (!msg.subarray(8, 20).equals(txid)) {
        finish(false, 'transaction id mismatch');
        return;
      }
      finish(true, null, readXorMapped(msg));
    });

    socket.on('error', (err) => finish(false, err.message));

    const request = Buffer.alloc(20);
    request.writeUInt16BE(BINDING_REQUEST, 0);
    // length 0 (no attributes), magic cookie, transaction id
    request.writeUInt32BE(MAGIC_COOKIE, 4);
    txid.copy(request, 8);

    try {
      socket.send(request, input.port, input.host);
    } catch (err) {
      finish(false, (err as Error).message);
    }
  });
}

/** Reads XOR-MAPPED-ADDRESS, or null when the reply carries none. */
function readXorMapped(msg: Buffer): { ip: string; port: number } | null {
  let off = 20;
  while (off + 4 <= msg.length) {
    const attrType = msg.readUInt16BE(off);
    const attrLen = msg.readUInt16BE(off + 2);
    if (attrType === ATTR_XOR_MAPPED && attrLen >= 8) {
      const xport = msg.readUInt16BE(off + 4) ^ (MAGIC_COOKIE >>> 16);
      const ip4 = Buffer.alloc(4);
      ip4.writeUInt32BE(msg.readUInt32BE(off + 8) ^ MAGIC_COOKIE, 0);
      return { ip: `${ip4[0]}.${ip4[1]}.${ip4[2]}.${ip4[3]}`, port: xport };
    }
    off += 4 + attrLen + ((4 - (attrLen % 4)) % 4);
  }
  // A valid binding response without the attribute still proves reachability.
  return null;
}
