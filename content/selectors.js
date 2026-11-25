// 모든 DOM 셀렉터는 이 파일에만 둔다. 디스코드 화면이 바뀌면 여기만 고친다.
// 전부 아직 가설이다. Phase 0 진단 리포트로 확인한 뒤 확정한다.
window.DCE = window.DCE || {};

DCE.selectors = {
  messageList: 'ol[data-list-id="chat-messages"]',
  message: 'li[id^="chat-messages-"]',
  time: 'time[datetime]',
  channelLink: 'a[href^="/channels/"]',
  channelItem: '[data-list-item-id^="channels___"]',
  dmLink: 'a[href^="/channels/@me/"]',

  // 메시지 ID로 정확히 찾는다. 앞부분만 맞추면 답장 미리보기 속 다른 메시지와 섞인다.
  username: (id) => `#message-username-${id}`,
  content: (id) => `#message-content-${id}`,
  accessories: (id) => `#message-accessories-${id}`,
  replyContext: (id) => `#message-reply-context-${id}`,

  // 진단할 때 종류를 어림잡는 용도. CLAUDE.md 표에 없는 추가 가설.
  attachment: 'a[href*="/attachments/"], img[src*="/attachments/"], video, audio',
  embed: 'article, [class*="embed" i]',
  systemMessage: '[class*="systemMessage" i]',
  categoryHeader: 'h2, h3, [aria-expanded]',
};
