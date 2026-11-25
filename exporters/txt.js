import { localDate, localTime } from '../shared/filename.js';

const INDENT = '    ';

function snippet(text) {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length > 30 ? `${chars.slice(0, 30).join('')}…` : chars.join('');
}

function messageLines(m) {
  const date = new Date(m.timestamp);
  const stamp = `[${localDate(date)} ${localTime(date)}]`;
  const body = m.content.replaceAll('\n', `\n${INDENT}`) + (m.edited ? ' (수정됨)' : '');
  const head = m.type === 'system' ? `${stamp} * ${body}` : `${stamp} ${m.author.name ?? '(알 수 없음)'}: ${body}`;

  const lines = [head.trimEnd()];
  if (m.replyTo) lines.push(`${INDENT}↳ 답장: ${m.replyTo.author ?? '(알 수 없음)'} 「${snippet(m.replyTo.snippet ?? '')}」`);
  for (const a of m.attachments) lines.push(`${INDENT}[첨부] ${a.name} ${a.url}`);
  for (const name of m.stickers) lines.push(`${INDENT}[스티커] ${name}`);
  for (const e of m.embeds) {
    const text = [e.title, e.url].filter(Boolean).join(' ') || snippet(e.description ?? '');
    if (text) lines.push(`${INDENT}[링크] ${text}`);
  }
  return lines;
}

// messages는 정렬과 작성자 채우기가 끝난 것이어야 한다. 시간은 PC 시간대로 적는다.
export function toTxt(messages) {
  const lines = [];
  let day = null;
  for (const m of messages) {
    const date = localDate(new Date(m.timestamp));
    if (date !== day) {
      lines.push(`──── ${date} ────`);
      day = date;
    }
    lines.push(...messageLines(m));
  }
  return lines.join('\n') + '\n';
}
