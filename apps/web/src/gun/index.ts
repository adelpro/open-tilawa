import Gun from 'gun/gun';
import 'gun/sea';
import { GUNCONFIG } from '@/constants/gun-config';

export const gun = Gun(GUNCONFIG);
export const user = gun.user().recall({ sessionStorage: true });
export const SEA = (Gun as unknown as { SEA: any }).SEA;

export const isLoggedIn = () => !!user.is;

export type GunAck = { err?: string; ok?: number; pub?: string } & Record<string, unknown>;
