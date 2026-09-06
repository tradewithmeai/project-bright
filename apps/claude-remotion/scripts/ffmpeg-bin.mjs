// ffmpeg-bin.mjs — per-platform resolver for the ffmpeg/ffprobe binaries Remotion bundles.
//
// Remotion ships full ffmpeg + ffprobe inside its platform-specific compositor package
// (e.g. @remotion/compositor-win32-x64-msvc/ffmpeg.exe). This resolves the right one for the
// current platform so the studio tools need no separate ffmpeg install — on Windows locally OR
// on a Linux render host. Order: $FFMPEG_BIN/$FFPROBE_BIN override → bundled → bare name on PATH.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ROOT = the claude-remotion app dir (parent of scripts/). Works locally AND in-container.
const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

function bundledBin(name) {
  const suffix = process.platform === 'win32' ? '-msvc'
    : process.platform === 'linux' ? '-gnu'
      : ''; // darwin: no suffix
  const dir = `@remotion/compositor-${process.platform}-${process.arch}${suffix}`;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return join(ROOT, 'node_modules', dir, exe);
}

export function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  const b = bundledBin('ffmpeg');
  return existsSync(b) ? b : 'ffmpeg';
}

export function resolveFfprobe() {
  if (process.env.FFPROBE_BIN) return process.env.FFPROBE_BIN;
  const b = bundledBin('ffprobe');
  return existsSync(b) ? b : 'ffprobe';
}
