import { describe, expect, it } from 'vitest';
import { screenshotMethod } from '../src/screenshot';

const key = (over: Partial<KeyboardEvent>): KeyboardEvent =>
  ({ key: '', metaKey: false, shiftKey: false, ctrlKey: false, altKey: false, ...over }) as KeyboardEvent;

describe('screenshotMethod', () => {
  it('recognises each desktop’s screenshot shortcuts', () => {
    expect(screenshotMethod(key({ key: 'PrintScreen' }))).toBe('printscreen');
    for (const k of ['3', '4', '5']) {
      expect(screenshotMethod(key({ key: k, metaKey: true, shiftKey: true }))).toBe('mac-capture');
    }
    expect(screenshotMethod(key({ key: 'S', metaKey: true, shiftKey: true }))).toBe('win-snip');
    expect(screenshotMethod(key({ key: 's', metaKey: true, shiftKey: true }))).toBe('win-snip');
  });

  it('ignores the same keys without their modifiers', () => {
    for (const k of ['3', '4', '5', 's', 'S']) {
      expect(screenshotMethod(key({ key: k })), k).toBeNull();
      expect(screenshotMethod(key({ key: k, metaKey: true })), `meta+${k}`).toBeNull();
      expect(screenshotMethod(key({ key: k, shiftKey: true })), `shift+${k}`).toBeNull();
    }
  });

  it('ignores ordinary typing and the app’s own shortcut', () => {
    for (const k of ['a', 'Escape', 'Enter', ' ', 'ArrowLeft', '1', '2', '6', 'Meta', 'Shift']) {
      expect(screenshotMethod(key({ key: k })), k).toBeNull();
    }
    // cmd+4 = tab switch, must not count
    expect(screenshotMethod(key({ key: '4', metaKey: true }))).toBeNull();
  });

  it('ignores the ctrl-key equivalents', () => {
    expect(screenshotMethod(key({ key: '4', ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(screenshotMethod(key({ key: 's', ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});
