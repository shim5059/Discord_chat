// 진단 리포트에 실제 내용이 새지 않는지 확인한다. 데이터는 전부 가짜다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ URL, location: { origin: 'https://discord.com' } });
context.window = context;
for (const name of ['selectors', 'diagnose']) {
  vm.runInContext(readFileSync(new URL(`../content/${name}.js`, import.meta.url), 'utf8'), context);
}
const { mask } = context.DCE;

test('글자는 길이만 남긴다', () => {
  assert.equal(mask.text('  안녕하세요 👋 '), '「7자」');
  assert.equal(mask.text('   '), '');
});

test('id와 클래스는 구조만 남긴다', () => {
  assert.equal(mask.id('chat-messages-1310000000000000000-1310000000000000001'), 'chat-messages-{id}-{id}');
  assert.equal(mask.id('홍길동123'), '「6자」');
  assert.equal(mask.classPrefix('message__5126c'), 'message');
  assert.equal(mask.classPrefix('wrapper_c19a55'), 'wrapper');
  assert.equal(mask.classPrefix('messageListItem_SY_P2T'), 'messageListItem');
  assert.equal(mask.classPrefix('overflow__WDjet'), 'overflow');
  assert.equal(mask.classPrefix('container_QlL4f-'), 'container');
  assert.equal(mask.classPrefix('hljs'), 'hljs');
  assert.equal(mask.classPrefix('홍길동'), '「3자」');
});

test('긴 HTML은 앞부분만 남긴다', () => {
  assert.equal(mask.clip('abcdef', 3), 'abc…(잘림)');
  assert.equal(mask.clip('abc', 3), 'abc');
});

test('디스코드 주소는 모양만 남기고 ID, 파일명, 서명 값을 지운다', () => {
  assert.equal(
    mask.url('https://cdn.discordapp.com/attachments/1310000000000000000/1310000000000000001/my_photo.png?ex=6a1b&is=6a1c&hm=dead&'),
    'cdn.discordapp.com/attachments/{id}/{id}/「8자」.png?ex&is&hm',
  );
  assert.equal(
    mask.url('https://cdn.discordapp.com/avatars/1310000000000000000/a_0123456789abcdef0123456789abcdef.webp?size=80'),
    'cdn.discordapp.com/avatars/{id}/{hash}.webp?size',
  );
  assert.equal(mask.url('/channels/1310000000000000000/1310000000000000001'), '/channels/{id}/{id}');
  assert.equal(mask.url('/channels/@me/1310000000000000000'), '/channels/@me/{id}');
});

test('외부 주소와 특수 주소는 숨긴다', () => {
  assert.equal(mask.url('https://example.com/private?q=1'), '{외부 주소}');
  assert.equal(mask.url('https://discord.com.example.com/x'), '{외부 주소}');
  assert.equal(mask.url('javascript:alert(1)'), 'javascript:');
  assert.equal(mask.url('data:image/png;base64,AAAA'), 'data:');
  assert.equal(
    mask.url('https://images-ext-1.discordapp.net/external/AbC/https/example.com/photo.jpg?width=1&token=abc'),
    'images-ext-1.discordapp.net/external/「3자」/https/「11자」/「5자」.jpg?width',
  );
});

test('채널 라벨은 이름을 지우고 종류만 남긴다', () => {
  assert.equal(mask.label('일반 (텍스트 채널)', ['일반']), '「2자」 (텍스트 채널)');
  assert.equal(mask.label('읽지 않음, 💬│잡담 (텍스트 채널)', ['💬│잡담']), '읽지 않음, 「4자」 (텍스트 채널)');
  assert.equal(mask.label('공지 (음성 채널)', ['공지']), '「2자」 (음성 채널)');
  assert.equal(mask.label('공부방 (음성 채널), 홍길동, 김철수', ['공부방']), '「3자」 (음성 채널), 「3자」, 「3자」');
  assert.equal(mask.label('일반 (채팅 채널)', ['일반']), '「2자」 (채팅 채널)');
  assert.equal(mask.label('general (voice channel)', []), '「7자」 (voice channel)');
  assert.equal(mask.label(null, []), null);
  assert.equal(mask.words('(3) Discord | #일반 | 우리집'), '(「1자」) Discord | #「2자」 | 「3자」');
});
