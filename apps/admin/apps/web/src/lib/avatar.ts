/**
 * Turning a picked file into an avatar, in the browser.
 *
 * This is where the work belongs: a phone photo is 3–8 MB and a crop has to be a
 * real crop, not a CSS trick. Decoding to a canvas, centre-cropping the shorter
 * axis and re-encoding at 512 px gives three things for free — the upload is 40–90
 * KB instead of megabytes, the crop is baked into the bytes, and **EXIF is gone**,
 * because `toBlob` writes a fresh image with no metadata to carry GPS or camera
 * serial numbers into our database.
 */

/** The edge we store. A 512 px square is sharp at the largest size the console draws. */
export const AVATAR_EDGE = 512;

/** Matches the server's cap: this file lands at 40–90 KB, so the margin is wide. */
export const AVATAR_MAX_BYTES = 512 * 1024;

export class AvatarRejected extends Error {}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Falls through: some browsers refuse HEIC in createImageBitmap but the
      // <img> path may still fail later with a clearer error.
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarRejected('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

function dimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return source instanceof ImageBitmap
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

/**
 * Centre-crop to a square and re-encode as JPEG.
 *
 * Level A of the two crop options: no drag handles, the middle of the frame wins.
 * The function is exported on its own so a pan/zoom crop can replace it later
 * without touching the upload path.
 */
export async function squareAvatar(file: File, edge = AVATAR_EDGE): Promise<Blob> {
  const source = await decode(file);
  const { width, height } = dimensions(source);
  if (!width || !height) throw new AvatarRejected('That image has no readable dimensions.');

  const side = Math.min(width, height);
  const sx = Math.round((width - side) / 2);
  const sy = Math.round((height - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext('2d');
  if (!context) throw new AvatarRejected('This browser cannot prepare the image.');

  // White first: a transparent PNG re-encoded as JPEG would otherwise composite
  // onto black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, edge, edge);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, sx, sy, side, side, 0, 0, edge, edge);
  if (source instanceof ImageBitmap) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85),
  );
  if (!blob) throw new AvatarRejected('The image could not be re-encoded.');
  if (blob.size > AVATAR_MAX_BYTES) {
    throw new AvatarRejected('That image could not be compressed small enough.');
  }
  return blob;
}
