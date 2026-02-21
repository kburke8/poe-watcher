import { describe, it, expect } from 'vitest';

// These are private functions inside AddComparisonModal.tsx, so we replicate them here for testing.
// In a production codebase, these should be extracted to a shared utility module.

function parseTimeInput(input: string): number {
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return 0;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

describe('parseTimeInput', () => {
  it('parses MM:SS format', () => {
    expect(parseTimeInput('5:30')).toBe(330_000);
    expect(parseTimeInput('0:45')).toBe(45_000);
    expect(parseTimeInput('12:00')).toBe(720_000);
    expect(parseTimeInput('59:59')).toBe(3_599_000);
  });

  it('parses HH:MM:SS format', () => {
    expect(parseTimeInput('1:30:00')).toBe(5_400_000);
    expect(parseTimeInput('0:05:30')).toBe(330_000);
    expect(parseTimeInput('2:00:00')).toBe(7_200_000);
    expect(parseTimeInput('1:23:45')).toBe(5_025_000);
  });

  it('handles edge cases', () => {
    expect(parseTimeInput('')).toBe(0);
    expect(parseTimeInput('abc')).toBe(0);
    expect(parseTimeInput('1:2:3:4')).toBe(0);
    expect(parseTimeInput('  5:30  ')).toBe(330_000); // trimmed
    expect(parseTimeInput('0:00')).toBe(0);
    expect(parseTimeInput('a:b')).toBe(0);
    expect(parseTimeInput(':')).toBe(0);
  });

  it('handles single number (no colon)', () => {
    // Single value without colon - no 1-part or 4+ parts handling
    expect(parseTimeInput('300')).toBe(0);
  });
});

describe('formatTime', () => {
  it('formats sub-hour times as MM:SS', () => {
    expect(formatTime(330_000)).toBe('5:30');
    expect(formatTime(45_000)).toBe('0:45');
    expect(formatTime(720_000)).toBe('12:00');
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats hour+ times as H:MM:SS', () => {
    expect(formatTime(3_600_000)).toBe('1:00:00');
    expect(formatTime(5_400_000)).toBe('1:30:00');
    expect(formatTime(5_025_000)).toBe('1:23:45');
  });

  it('pads correctly', () => {
    expect(formatTime(61_000)).toBe('1:01');
    expect(formatTime(3_661_000)).toBe('1:01:01');
  });

  it('round-trips with parseTimeInput', () => {
    const inputs = ['5:30', '0:45', '1:30:00', '1:23:45', '0:00'];
    for (const input of inputs) {
      const ms = parseTimeInput(input);
      expect(formatTime(ms)).toBe(input);
    }
  });
});
