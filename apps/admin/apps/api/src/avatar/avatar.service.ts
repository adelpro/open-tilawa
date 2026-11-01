import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { UsersRepository, type UserAvatar } from '@tilawa-admin/core';
import {
  MAX_AVATAR_EDGE,
  MAX_AVATAR_BYTES,
  looksLikeMarkup,
  readRawBody,
  sniff,
  stripJpegMetadata,
} from './avatar.util';
import type { IncomingMessage } from 'node:http';

export interface AvatarUploadResult {
  avatarUpdatedAt: string;
  bytes: number;
  mime: string;
}

/**
 * Accepts an avatar or explains why it will not.
 *
 * The order matters and is the whole security story: the size cap is enforced
 * while reading, the type comes from the bytes rather than the request's
 * `Content-Type`, markup is refused before anything else is considered, and the
 * dimensions are read from the header so a decompression bomb never reaches a
 * decoder.
 */
@Injectable()
export class AvatarService {
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  async accept(userId: number, request: IncomingMessage): Promise<AvatarUploadResult> {
    const raw = await this.readBytes(request);

    if (raw.length === 0) throw new BadRequestException('The request carried no image bytes');
    if (looksLikeMarkup(raw)) {
      // SVG and HTML are refused by name: both are executable in a browser context,
      // and an avatar is served from the same origin as the session cookie.
      throw new UnsupportedMediaTypeException('Only JPEG, PNG and WebP images are accepted');
    }

    const sniffed = sniff(raw);
    if (!sniffed) {
      throw new UnsupportedMediaTypeException('Only JPEG, PNG and WebP images are accepted');
    }
    if (sniffed.width < 1 || sniffed.height < 1) {
      throw new BadRequestException('The image has no readable dimensions');
    }
    if (sniffed.width > MAX_AVATAR_EDGE || sniffed.height > MAX_AVATAR_EDGE) {
      throw new BadRequestException(`An avatar must be at most ${MAX_AVATAR_EDGE}px on each side`);
    }

    const { bytes } =
      sniffed.mime === 'image/jpeg' ? stripJpegMetadata(raw) : { bytes: raw as Buffer };

    if (bytes.length > MAX_AVATAR_BYTES) throw new PayloadTooLargeException();

    const avatarUpdatedAt = this.users.setAvatar(userId, bytes, sniffed.mime);
    return { avatarUpdatedAt, bytes: bytes.length, mime: sniffed.mime };
  }

  clear(userId: number): void {
    this.users.clearAvatar(userId);
  }

  read(userId: number): UserAvatar | null {
    return this.users.getAvatar(userId);
  }

  private async readBytes(request: IncomingMessage): Promise<Buffer> {
    try {
      return await readRawBody(request);
    } catch (error) {
      if (error instanceof Error && error.name === 'AvatarTooLargeError') {
        throw new PayloadTooLargeException(
          `An avatar must be smaller than ${Math.round(MAX_AVATAR_BYTES / 1024)} KB`,
        );
      }
      throw new BadRequestException('The upload could not be read');
    }
  }
}
