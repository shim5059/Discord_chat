// 모든 DOM 셀렉터는 이 파일에만 둔다. 디스코드 화면이 바뀌면 여기만 고친다.
//
// 근거: 2026-11-26, 웨일 5.41, 한국어 화면의 진단 리포트
//   R1  서버 채팅 채널, 맨 아래 (메시지 13개, 사진 위주)
//   R2  채널 맨 위 (아직 없음)
//   R3  친구 화면. DM 목록만 있고 대화는 열지 않음
//   R4  DM 대화, 맨 아래 (메시지 39개, 글과 GIF)
// "확인"은 그 리포트에 실제로 나온 것, "미확인"은 아직 본 적 없는 것이다.
//
// 클래스는 message_SY_P2T처럼 "이름_해시" 모양이다. 해시는 바뀌므로 [class*="이름_"]로 앞부분만 맞춘다.
window.DCE = window.DCE || {};

DCE.selectors = {
  // ── 메시지 목록 ──
  messageList: 'ol[data-list-id="chat-messages"]', // 확인 R1, R4
  scroller: '[class*="scroller_"]', // 확인 R1, R4: 목록에서 closest()로 찾는, 실제로 스크롤되는 조상
  message: 'li[id^="chat-messages-"]', // 확인 R1, R4: id = chat-messages-<채널ID>-<메시지ID>
  skeleton: '[class*="blob_"]', // 확인 R1, R4: 위에 더 불러올 메시지가 있으면 목록 맨 위에 나오는 회색 자리표시
  channelStart: '[class*="hannelIcon_"]', // 미확인: 채널 맨 위의 환영 영역

  // ── 메시지 하나 ──
  // ID로 정확히 찾는다. 앞부분만 맞추면 답장 미리보기 속 다른 메시지와 섞인다.
  timestamp: (id) => `#message-timestamp-${id}`, // 확인 R1 13/13, R4 39/39: datetime이 ISO 시각
  username: (id) => `#message-username-${id}`, // 확인 R1 9/13, R4 21/39: 나머지는 연속 메시지
  content: (id) => `#message-content-${id}`, // 확인 R1 13/13, R4 39/39: 첨부만 있어도 빈 요소가 있다
  accessories: (id) => `#message-accessories-${id}`, // 확인 R1 13/13, R4 39/39
  reactions: (id) => `#message-reactions-${id}`, // 확인 R1 3/13
  replyContext: (id) => `#message-reply-context-${id}`, // 미확인

  time: 'time[datetime]', // 확인 R1, R4: 메시지마다 1개. 수정된 메시지는 더 있을 수 있으니 시각은 timestamp로 찾는다
  usernameText: '[class*="username_"]', // 확인 R1, R4: username 안쪽. data-text 속성에도 같은 길이의 이름이 있다
  avatar: 'img[class*="avatar_"]', // 확인 R1, R4: /avatars/<id>/ 와 /users/<id>/avatars/ 둘 다 나왔다(R1)
  edited: '[class*="edited_"]', // 미확인

  // ── 첨부, 임베드, 반응 ──
  // GIF도 originalLink와 video를 쓰지만 주소가 외부다(R4). 첨부는 주소의 앞부분까지 맞춘다.
  attachment: '[href^="https://cdn.discordapp.com/attachments/"], [src^="https://cdn.discordapp.com/attachments/"]', // 확인 R1
  imageLink: 'a[class*="originalLink_"][href^="https://cdn.discordapp.com/attachments/"]', // 확인 R1: 원본 주소. 화면 밖 img는 src가 data:라 쓰지 않는다
  audioSource: 'audio source[src^="https://cdn.discordapp.com/attachments/"]', // 확인 R1: 음성 메시지
  videoSource: 'video[src^="https://cdn.discordapp.com/attachments/"], video source[src^="https://cdn.discordapp.com/attachments/"]', // 미확인
  fileLink: 'a[class*="fileNameLink_"]', // 미확인
  gif: '[class*="inlineMediaEmbed_"]', // 확인 R4: 안의 originalLink가 GIF 페이지 주소, video가 실제 영상
  embed: 'article, [class*="embed" i]', // GIF는 확인 R4. 링크 미리보기는 미확인
  sticker: '[class*="stickerAsset_"]', // 미확인
  reaction: '[class*="reaction_"]', // 확인 R1: reactions 안쪽
  reactionCount: '[class*="reactionCount_"]', // 확인 R1
  emoji: 'img.emoji', // 확인 R1: 반응에서 확인. 본문 속 이모지는 미확인
  systemMessage: '[class*="systemMessage" i]', // 미확인

  // ── 사이드바 ──
  channelItem: '[data-list-item-id^="channels___"]', // 확인 R1: 33개 = 채팅 23 + 음성 4 + 카테고리 4 + 이벤트·부스트 2
  channelLink: 'a[href^="/channels/"]', // 확인 R1 23개, R3·R4 25개
  textChannel: 'a[role="link"][href^="/channels/"][data-list-item-id^="channels___"]', // 확인 R1: 23개. 공지·포럼·스레드는 미확인
  voiceChannel: 'a[role="button"]:not([href])[data-list-item-id^="channels___"]', // 확인 R1: 4개. 스테이지는 미확인
  category: '[aria-expanded][data-list-item-id^="channels___"]', // 확인 R1: 4개
  channelScroller: '#channels', // 확인 R1
  dmLink: 'a[href^="/channels/@me/"]', // 확인 R3, R4: 24개. 친구 버튼(/channels/@me)은 걸리지 않는다
  dmScroller: '[data-list-id^="private-channels"]', // 확인 R3, R4

  // ── 이름 ──
  guildName: 'header h2[class*="name_"]', // 확인 R1. DM에는 없다(R4)
  channelName: 'section h1[class*="title_"]', // 확인 R1, R3, R4
};

// 미확인 셀렉터의 대안 후보. 진단 리포트가 함께 세어 주므로 다음 리포트로 고른다.
DCE.candidates = {
  channelStart: ['[class*="emptyChannelIcon_"]', '[class*="channelIcon_"]', 'h1', 'h2', 'h3:not(li h3)'],
  replyContext: ['[id^="message-reply-context-"]', '[class*="repliedMessage_"]', '[class*="replyBar_"]'],
  edited: ['[class*="edited_"]', '[id^="message-content-"] time'],
  videoSource: ['video', 'video[src]', 'video source[src]'],
  fileLink: ['a[class*="fileNameLink_"]', '[class*="nonVisualMediaItem_"] a[href*="/attachments/"]', '[class*="file" i] a[href*="/attachments/"]'],
  embed: ['article', '[class*="embedFull_"]', '[class*="embedWrapper_"]', '[class*="embedTitle_"]', '[class*="embedDescription_"]'],
  sticker: ['[class*="stickerAsset_"]', 'img[src*="/stickers/"]', '[class*="sticker" i]'],
  contentEmoji: ['[id^="message-content-"] img.emoji', '[id^="message-content-"] [data-type="emoji"]'],
  systemMessage: ['[class*="systemMessage_"]', '[class*="isSystemMessage_"]'],
};
