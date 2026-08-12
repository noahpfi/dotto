// mobile browsers expose no screenshot event
export type ScreenshotMethod = 'printscreen' | 'mac-capture' | 'win-snip';

export function screenshotMethod(event: KeyboardEvent): ScreenshotMethod | null {
  // PrintScreen on Windows and most Linux, Chrome delivers on keyup only
  if (event.key === 'PrintScreen') return 'printscreen';
  // macOS cmd+shift+3/4/5 still reach page as keydown
  if (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(event.key)) return 'mac-capture';
  // Windows Snipping Tool, metaKey = Windows key
  if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 's') return 'win-snip';
  return null;
}
