// 데이터는 전부 가짜다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { toJson } from '../exporters/json.js';
import { toTxt } from '../exporters/txt.js';

// PC 시간대로 적기 때문에, 어느 시간대에서 돌려도 같게 현지 시각으로 만든다.
const at = (day, hour, minute) => new Date(2026, 10, day, hour, minute).toISOString();
const message = (over) => ({
  id: '1',
  channelId: '9',
  timestamp: at(25, 0, 12),
  type: 'default',
  author: { id: '1', name: '김가짜', avatarUrl: null },
  content: '안녕',
  attachments: [],
  embeds: [],
  stickers: [],
  reactions: [],
  replyTo: null,
  edited: false,
  ...over,
});
const body = (over) => toTxt([message(over)]).split('\n').slice(1, -1);

test('TXT: 날짜가 바뀔 때만 구분선을 넣는다', () => {
  assert.equal(
    toTxt([message(), message({ timestamp: at(25, 23, 59) }), message({ timestamp: at(26, 0, 0), content: '다음 날' })]),
    '──── 2026-11-25 ────\n[2026-11-25 00:12] 김가짜: 안녕\n[2026-11-25 23:59] 김가짜: 안녕\n──── 2026-11-26 ────\n[2026-11-26 00:00] 김가짜: 다음 날\n',
  );
});

test('TXT: 수정됨과 여러 줄 본문', () => {
  assert.deepEqual(body({ content: '첫 줄\n둘째 줄', edited: true }), ['[2026-11-25 00:12] 김가짜: 첫 줄', '    둘째 줄 (수정됨)']);
});

test('TXT: 답장은 원문 앞 30자까지', () => {
  assert.deepEqual(body({ replyTo: { id: '2', author: '이가짜', snippet: '짧은\n원문' } }), ['[2026-11-25 00:12] 김가짜: 안녕', '    ↳ 답장: 이가짜 「짧은 원문」']);
  assert.equal(body({ replyTo: { id: '2', author: '이가짜', snippet: '가'.repeat(31) } })[1], `    ↳ 답장: 이가짜 「${'가'.repeat(30)}…」`);
  assert.equal(body({ replyTo: { id: null, author: null, snippet: null } })[1], '    ↳ 답장: (알 수 없음) 「」');
});

test('TXT: 첨부, 스티커, 링크', () => {
  assert.deepEqual(
    body({
      content: '',
      attachments: [{ name: 'a.png', url: 'https://cdn.discordapp.com/attachments/1/2/a.png?ex=1', type: 'image' }],
      stickers: ['손 흔들기'],
      embeds: [
        { title: '제목', url: 'https://example.com', description: '설명' },
        { title: null, url: 'https://example.com/gif', description: null },
        { title: null, url: null, description: '봇이 보낸 설명' },
        { title: null, url: null, description: null },
      ],
    }),
    [
      '[2026-11-25 00:12] 김가짜:',
      '    [첨부] a.png https://cdn.discordapp.com/attachments/1/2/a.png?ex=1',
      '    [스티커] 손 흔들기',
      '    [링크] 제목 https://example.com',
      '    [링크] https://example.com/gif',
      '    [링크] 봇이 보낸 설명',
    ],
  );
});

test('TXT: 시스템 메시지와 작성자를 모르는 메시지', () => {
  const unknown = { id: null, name: null, avatarUrl: null };
  assert.deepEqual(body({ type: 'system', author: unknown, content: '김가짜 님이 참가했어요' }), ['[2026-11-25 00:12] * 김가짜 님이 참가했어요']);
  assert.deepEqual(body({ author: unknown }), ['[2026-11-25 00:12] (알 수 없음): 안녕']);
});

test('JSON: 출처, 개수, 기간을 함께 적는다', () => {
  const messages = [message({ id: '1310000000000000000' }), message({ id: '1310000000000000001', timestamp: at(26, 3, 0) })];
  const meta = { guildId: '7', guildName: '우리 서버', channelId: '9', channelName: '일반', kind: 'text', chunkCount: 1 };
  const parsed = JSON.parse(toJson(messages, meta, new Date('2026-11-26T01:02:03.000Z')));
  assert.deepEqual(Object.keys(parsed), ['exportedAt', 'source', 'messageCount', 'range', 'messages']);
  assert.equal(parsed.exportedAt, '2026-11-26T01:02:03.000Z');
  assert.deepEqual(parsed.source, { guildId: '7', guildName: '우리 서버', channelId: '9', channelName: '일반', url: 'https://discord.com/channels/7/9' });
  assert.equal(parsed.messageCount, 2);
  assert.deepEqual(parsed.range, { from: at(25, 0, 12), to: at(26, 3, 0) });
  assert.deepEqual(parsed.messages, messages);
});

test('JSON: 메시지가 없으면 기간은 null', () => {
  const parsed = JSON.parse(toJson([], { guildId: '@me', guildName: 'DM', channelId: '9', channelName: '가짜' }, new Date(0)));
  assert.deepEqual(parsed.range, { from: null, to: null });
  assert.equal(parsed.source.url, 'https://discord.com/channels/@me/9');
});
