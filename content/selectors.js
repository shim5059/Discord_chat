// 모든 DOM 셀렉터는 이 파일에만 둔다. 디스코드 화면이 바뀌면 여기만 고친다.
//
// 근거: 2026-11-26, 웨일 5.41, 한국어 화면의 진단 리포트
//   R1  서버 채팅 채널, 맨 아래 (메시지 13개, 사진 위주)
//   R2  테스트 채널 전체 (메시지 8개. 채널 시작, 답장, 수정, 링크 미리보기, 영상, GIF, 고정 알림)
//   R3  친구 화면. DM 목록만 있고 대화는 열지 않음
//   R4  DM 대화, 맨 아래 (메시지 39개, 글과 GIF)
// "확인"은 그 리포트에 실제로 나온 것, "미확인"은 아직 본 적 없는 것이다.
//
// 클래스는 message_SY_P2T처럼 "이름_해시" 모양이다. 해시는 바뀌므로 [class*="이름_"]로 앞부분만 맞춘다.
window.DCE = window.DCE || {};

DCE.selectors = {
  // ── 메시지 목록 ──
  messageList: 'ol[data-list-id="chat-messages"]', // 확인 R1, R2, R4
  scroller: '[class*="scroller_"]', // 확인 R1, R2, R4: 목록에서 closest()로 찾는, 실제로 스크롤되는 조상
  message: 'li[id^="chat-messages-"]', // 확인 R1, R2, R4: id = chat-messages-<채널ID>-<메시지ID>
  skeleton: '[class*="blob_"]', // 확인 R1, R4에 있고 R2에 없음: 위에 더 불러올 메시지가 있을 때만 나오는 회색 자리표시
  channelStart: 'div[id^="chat-messages-"]', // 확인 R2에 1개, R1·R4에 없음: 환영 영역. 메시지와 id 모양이 같지만 li가 아니라 div다. DM은 미확인

  // ── 메시지 하나 ──
  // ID로 정확히 찾는다. 앞부분만 맞추면 답장 미리보기 속 다른 메시지와 섞인다.
  timestamp: (id) => `#message-timestamp-${id}`, // 확인 R1 13/13, R4 39/39, R2 7/8: 시스템 메시지에만 없다. datetime이 ISO 시각
  username: (id) => `#message-username-${id}`, // 확인 R1 9/13, R2 2/8, R4 21/39: 나머지는 연속·시스템 메시지
  content: (id) => `#message-content-${id}`, // 확인 R1, R2, R4 전부: 첨부만 있어도 빈 요소가 있고, 시스템 메시지 글도 여기 있다
  accessories: (id) => `#message-accessories-${id}`, // 확인 R1, R2, R4 전부
  reactions: (id) => `#message-reactions-${id}`, // 확인 R1 3/13
  replyContext: (id) => `#message-reply-context-${id}`, // 확인 R2 1/8

  time: 'time[datetime]', // 확인 R2: 답장은 원문의 수정 시각이 먼저 나온다. timestamp가 없는 시스템 메시지에만 쓴다
  usernameText: '[class*="username_"]', // 확인 R1, R2, R4: username과 replyContext 안쪽. data-text에도 이름이 있다
  avatar: 'img[class*="avatar_"]', // 확인 R1, R2, R4: /avatars/<id>/ 와 /users/<id>/avatars/ 둘 다 나왔다(R1)
  systemMessage: '[class*="systemMessage_"]', // 확인 R2

  // ── 본문과 답장 안쪽 ──
  edited: '[class*="edited_"]', // 확인 R2: content 안의 time 속. 답장 미리보기에도 나오므로 content 안에서만 본다
  hiddenText: '[class*="hiddenVisually_"]', // 확인 R2: 본문에 섞인, 눈에 안 보이는 날짜 설명
  timeMark: '[class*="timestamp_"]', // 확인 R2: 본문 안의 (수정됨) 시각, 시스템 메시지의 시각
  codeBlock: 'pre', // 확인 R2: 안에 복사 버튼(codeActions_)이 섞여 있어 글은 codeText에서만 읽는다
  codeText: 'code', // 확인 R2
  emoji: 'img.emoji', // 확인 R1(반응), R2(본문): alt가 이모지
  repliedContent: '[id^="message-content-"]', // 확인 R2: replyContext 안에서만 쓴다. id 끝이 원문의 메시지ID

  // ── 첨부, 임베드, 반응 ──
  // GIF도 originalLink와 video를 쓰지만 주소가 외부다(R4). 첨부는 주소의 앞부분까지 맞춘다.
  attachment: '[href^="https://cdn.discordapp.com/attachments/"], [src^="https://cdn.discordapp.com/attachments/"]', // 확인 R1(사진, 음성), R2(사진, 영상). 일반 파일은 미확인
  imageLink: 'a[class*="originalLink_"][href^="https://cdn.discordapp.com/attachments/"]', // 확인 R1, R2: 원본 주소. 화면 밖 img는 src가 data:라 쓰지 않는다
  audioSource: 'audio source[src^="https://cdn.discordapp.com/attachments/"]', // 확인 R1: 음성 메시지
  videoSource: 'video source[src^="https://cdn.discordapp.com/attachments/"]', // 확인 R2: 같은 주소의 다운로드 링크 a도 있다
  fileLink: 'a[class*="fileNameLink_"]', // 미확인
  embed: 'article[class*="embedFull_"], [class*="inlineMediaEmbed_"]', // 확인 R2(링크 미리보기), R2·R4(GIF)
  embedTitle: '[class*="embedTitle_"]', // 확인 R2
  embedTitleLink: 'a[class*="embedTitleLink_"]', // 확인 R2
  embedDescription: '[class*="embedDescription_"]', // 확인 R2
  gif: '[class*="inlineMediaEmbed_"]', // 확인 R2, R4: 안의 originalLink가 GIF 페이지 주소
  gifLink: 'a[class*="originalLink_"]', // 확인 R2, R4: gif 안쪽
  sticker: '[class*="stickerAsset_"]', // 미확인
  reaction: '[class*="reaction_"]', // 확인 R1: reactions 안쪽
  reactionCount: '[class*="reactionCount_"]', // 확인 R1

  // ── 사이드바 ──
  channelItem: '[data-list-item-id^="channels___"]', // 확인 R1: 33개 = 채팅 23 + 음성 4 + 카테고리 4 + 이벤트·부스트 2
  channelLink: 'a[href^="/channels/"]', // 확인 R1~R4
  textChannel: 'a[role="link"][href^="/channels/"][data-list-item-id^="channels___"]', // 확인 R1 23개, R2 6개. 공지·포럼·스레드는 미확인
  voiceChannel: 'a[role="button"]:not([href])[data-list-item-id^="channels___"]', // 확인 R1 4개, R2 1개. 스테이지는 미확인
  category: '[aria-expanded][data-list-item-id^="channels___"]', // 확인 R1 4개, R2 2개
  channelItemName: '[class*="name_"]', // 확인 R2(채널), R3·R4(DM): 링크 안쪽
  channelScroller: '#channels', // 확인 R1, R2
  dmLink: 'a[href^="/channels/@me/"]', // 확인 R3, R4: 24개. 친구 버튼(/channels/@me)은 걸리지 않는다
  dmScroller: '[data-list-id^="private-channels"]', // 확인 R3, R4

  // ── 이름 ──
  guildName: 'header h2[class*="name_"]', // 확인 R1, R2. DM에는 없다(R4)
  channelName: 'section h1[class*="title_"]', // 확인 R1~R4
};

// 미확인 셀렉터의 대안 후보. 진단 리포트가 함께 세어 주므로 다음 리포트로 고른다.
DCE.candidates = {
  channelStart: ['div[id^="chat-messages-"]', '[class*="emptyChannelIcon_"]'],
  fileLink: ['a[class*="fileNameLink_"]', '[class*="nonVisualMediaItem_"] a[href*="/attachments/"]', '[class*="file" i] a[href*="/attachments/"]'],
  sticker: ['[class*="stickerAsset_"]', 'img[src*="/stickers/"]', '[class*="sticker" i]'],
};
