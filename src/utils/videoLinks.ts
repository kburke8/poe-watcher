/**
 * Video URL parsing and timestamped link generation for Twitch VODs and YouTube videos.
 */

export type VideoProvider = 'twitch' | 'youtube' | 'unknown';

export interface ParsedVideoUrl {
  provider: VideoProvider;
  baseUrl: string;
  timestampMs: number;
}

/**
 * Parse Twitch timestamp format: XhYmZs (handles partial like 49s, 5m30s, 1h2m3s)
 */
export function parseTwitchTimestamp(ts: string): number {
  let ms = 0;
  const hMatch = ts.match(/(\d+)h/);
  const mMatch = ts.match(/(\d+)m/);
  const sMatch = ts.match(/(\d+)s/);
  if (hMatch) ms += parseInt(hMatch[1], 10) * 3600000;
  if (mMatch) ms += parseInt(mMatch[1], 10) * 60000;
  if (sMatch) ms += parseInt(sMatch[1], 10) * 1000;
  return ms;
}

/**
 * Parse YouTube timestamp format: plain seconds (1829 or 1829s)
 */
export function parseYouTubeTimestamp(ts: string): number {
  const seconds = parseInt(ts.replace(/s$/, ''), 10);
  return isNaN(seconds) ? 0 : seconds * 1000;
}

/**
 * Detect provider, extract timestamp, return clean base URL.
 */
export function parseVideoUrl(url: string): ParsedVideoUrl {
  try {
    const parsed = new URL(url);

    // Twitch: twitch.tv/videos/XXXX
    if (parsed.hostname.includes('twitch.tv') && /\/videos\/\d+/.test(parsed.pathname)) {
      const tParam = parsed.searchParams.get('t');
      const timestampMs = tParam ? parseTwitchTimestamp(tParam) : 0;
      // Build base URL without timestamp
      parsed.searchParams.delete('t');
      const baseUrl = parsed.toString();
      return { provider: 'twitch', baseUrl, timestampMs };
    }

    // YouTube: youtube.com/watch or youtu.be/
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      const tParam = parsed.searchParams.get('t');
      const timestampMs = tParam ? parseYouTubeTimestamp(tParam) : 0;
      // Build base URL without timestamp
      parsed.searchParams.delete('t');
      const baseUrl = parsed.toString();
      return { provider: 'youtube', baseUrl, timestampMs };
    }

    return { provider: 'unknown', baseUrl: url, timestampMs: 0 };
  } catch {
    return { provider: 'unknown', baseUrl: url, timestampMs: 0 };
  }
}

/**
 * Append a timestamp parameter to a base URL for the given provider.
 */
export function generateVideoLink(baseUrl: string, provider: VideoProvider, offsetMs: number): string {
  if (offsetMs < 0) offsetMs = 0;

  if (provider === 'twitch') {
    const totalSeconds = Math.floor(offsetMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const timestamp = `${h}h${m}m${s}s`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${timestamp}`;
  }

  if (provider === 'youtube') {
    const totalSeconds = Math.floor(offsetMs / 1000);
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${totalSeconds}s`;
  }

  // Unknown provider — just return the base URL
  return baseUrl;
}

/**
 * Compute a timestamped video link for a specific snapshot.
 * videoStartOffsetMs = where the run starts in the video.
 * snapshotElapsedMs = how far into the run this snapshot was taken.
 */
export function getSnapshotVideoLink(
  videoUrl: string,
  videoStartOffsetMs: number,
  snapshotElapsedMs: number,
): string {
  const { provider, baseUrl } = parseVideoUrl(videoUrl);
  const totalOffsetMs = videoStartOffsetMs + snapshotElapsedMs;
  return generateVideoLink(baseUrl, provider, totalOffsetMs);
}

/**
 * Format milliseconds as H:MM:SS or M:SS for display.
 */
export function formatOffsetTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse a user-entered time string (H:MM:SS or M:SS or SS) to milliseconds.
 */
export function parseOffsetInput(input: string): number {
  const parts = input.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  if (parts.length === 1) {
    return parts[0] * 1000;
  }
  return 0;
}
