const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

// Windows와 chrome.downloads가 모두 받아주는 이름으로 바꾼다.
export function safeName(name, max = 50) {
  const clean = [...name.replace(/[\\/:*?"<>|]/g, '_').replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, '')]
    .slice(0, max)
    .join('')
    .replace(/^[\s.~]+|[\s.~]+$/g, '');
  if (!clean) return '이름없음';
  return RESERVED.test(clean.split('.')[0]) ? `_${clean}` : clean;
}

const two = (n) => String(n).padStart(2, '0');

export const localDate = (date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
export const localTime = (date) => `${two(date.getHours())}:${two(date.getMinutes())}`;

export function exportFilename(guildName, channelName, date, ext) {
  const stamp = `${localDate(date)}-${localTime(date)}`.replace(/^(\d+)-(\d+)-(\d+)-(\d+):(\d+)$/, '$1$2$3-$4$5');
  return `discord_${safeName(guildName)}_${safeName(channelName)}_${stamp}.${ext}`;
}
