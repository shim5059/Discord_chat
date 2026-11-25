// 데이터는 전부 가짜다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fillAuthors } from '../shared/authors.js';
import { exportFilename, safeName } from '../shared/filename.js';
import { snowflakeTime, sortUnique } from '../shared/snowflake.js';

test('스노플레이크에서 생성 시각을 구한다', () => {
  // 디스코드 개발자 문서의 예시 ID
  assert.equal(new Date(snowflakeTime('175928847299117063')).toISOString(), '2016-04-30T11:18:25.796Z');
  assert.equal(snowflakeTime('0'), 1420070400000);
});

test('ID 순으로 정렬하고, 자릿수가 달라도 숫자 크기로 비교한다', () => {
  const ids = ['1310000000000000001', '99999999999999999', '1310000000000000000'];
  assert.deepEqual(sortUnique(ids.map((id) => ({ id }))).map((m) => m.id), ['99999999999999999', '1310000000000000000', '1310000000000000001']);
});

test('Number로는 같아지는 ID도 서로 다른 메시지로 본다', () => {
  assert.equal(Number('1310000000000000000'), Number('1310000000000000001'));
  assert.equal(sortUnique([{ id: '1310000000000000000' }, { id: '1310000000000000001' }]).length, 2);
});

test('같은 ID는 나중에 수집한 것을 남긴다', () => {
  assert.deepEqual(sortUnique([{ id: '5', content: '옛것' }, { id: '4' }, { id: '5', content: '새것' }]), [{ id: '4' }, { id: '5', content: '새것' }]);
});

const none = { id: null, name: null, avatarUrl: null };
const kim = { id: '1', name: '김가짜', avatarUrl: null };
const lee = { id: '2', name: '이가짜', avatarUrl: null };

test('연속 메시지의 작성자를 직전 작성자로 채운다', () => {
  const filled = fillAuthors([
    { id: '1', type: 'default', author: kim },
    { id: '2', type: 'default', author: none },
    { id: '3', type: 'reply', author: lee },
    { id: '4', type: 'default', author: none },
  ]);
  assert.deepEqual(filled.map((m) => m.author.name), ['김가짜', '김가짜', '이가짜', '이가짜']);
});

test('시스템 메시지는 채우지 않고, 앞뒤 묶음에도 영향을 주지 않는다', () => {
  const filled = fillAuthors([
    { id: '1', type: 'default', author: kim },
    { id: '2', type: 'system', author: none },
    { id: '3', type: 'default', author: none },
  ]);
  assert.deepEqual(filled.map((m) => m.author.name), ['김가짜', null, '김가짜']);
});

test('맨 앞이 연속 메시지면 비워 둔다', () => {
  assert.equal(fillAuthors([{ id: '1', type: 'default', author: none }])[0].author.name, null);
});

test('원본 배열을 바꾸지 않는다', () => {
  const input = [{ id: '1', type: 'default', author: kim }, { id: '2', type: 'default', author: none }];
  fillAuthors(input);
  assert.equal(input[1].author.name, null);
});

test('파일 이름에 못 쓰는 것을 고친다', () => {
  assert.equal(safeName('a\\b/c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
  assert.equal(safeName('  이름. . '), '이름');
  assert.equal(safeName('..숨김'), '숨김');
  assert.equal(safeName('~임시~'), '임시');
  assert.equal(safeName('CON'), '_CON');
  assert.equal(safeName('com1.txt'), '_com1.txt');
  assert.equal(safeName('console'), 'console');
  assert.equal(safeName(`줄\n바꿈${String.fromCodePoint(0x200b, 0x202e)}`), '줄바꿈'); // 눈에 안 보이는 글자
  assert.equal(safeName('💬│수다방'), '💬│수다방');
  assert.equal(safeName('***'), '___');
  assert.equal(safeName('...'), '이름없음');
  assert.equal(safeName(''), '이름없음');
});

test('긴 이름은 이모지를 쪼개지 않고 자른다', () => {
  assert.equal([...safeName('😀'.repeat(80))].length, 50);
  assert.equal(safeName('가'.repeat(49) + ' 나'), '가'.repeat(49));
});

test('내보내기 파일 이름', () => {
  const date = new Date(2026, 10, 5, 9, 7);
  assert.equal(exportFilename('우리 서버', '자유/게시판', date, 'txt'), 'discord_우리 서버_자유_게시판_20261105-0907.txt');
  assert.ok(exportFilename('가'.repeat(300), '나'.repeat(300), date, 'json').length < 200);
});
