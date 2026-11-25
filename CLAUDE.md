# discord-exporter — Claude Code 작업 규칙

## 무엇을 만드나
discord.com 웹에서 사용자가 고른 채널·DM의 메시지를 **첫 메시지부터 전부** 모아 TXT · JSON · CSV · HTML(+첨부파일)로 내 PC에 저장하는 Manifest V3 브라우저 확장. 본인 계정으로 하는 개인 백업용이다.
- 테스트 브라우저는 네이버 웨일(크로미움). 크롬에서도 그대로 돌아가야 한다.
- 개발은 단계(Phase)별로 한다. 사용자가 말한 단계만 구현하고, 다음 단계 기능을 미리 만들지 않는다.

## 절대 규칙 (어기면 계정 정지 위험)
1. 화면에 그려진 DOM만 읽는다. 디스코드 토큰, 내부 API(`/api/v9/...`), 게이트웨이 WebSocket은 어떤 이유로도 쓰지 않는다.
2. `localStorage`·`sessionStorage`·쿠키에서 토큰을 찾지 않는다. `webpackChunkdiscord_app` 같은 디스코드 내부 모듈을 건드리지 않고, `world: "MAIN"` 스크립트도 주입하지 않는다.
3. 읽기 전용. 메시지 입력·전송, 반응, 삭제, 설정 변경 등 어떤 버튼도 누르지 않는다. 허용되는 조작은 ① 메시지 목록·사이드바 스크롤 ② **텍스트 채널·DM** 링크 클릭 ③ 같은 탭의 URL 이동뿐이다.
4. 음성·스테이지 채널은 클릭하면 통화에 들어가므로 절대 클릭하지 않고, 채널 목록에서도 뺀다.
5. `eval`, `new Function`, 원격 스크립트 로드 금지. 외부 라이브러리는 `lib/`에 파일로 넣는다(JSZip만 허용).
6. 프레임워크·번들러·빌드 단계 없음. 순수 JS/HTML/CSS로, "압축해제된 확장 로드"만으로 바로 동작해야 한다. `package.json`은 테스트와 라이브러리 받기용으로만 쓴다.
7. 권한은 이것만: `storage`, `unlimitedStorage`, `downloads` / host: `https://discord.com/*`, `https://cdn.discordapp.com/*`, `https://media.discordapp.net/*`. 더 필요하면 이유를 먼저 말하고 허락받는다.
8. 실제 대화 내용(내보낸 파일, 진단 리포트, 실데이터 픽스처)은 커밋하지 않는다. 테스트 데이터는 가짜로 만든다.

## 구조
```
[discord.com 탭]  content script — 전역은 window.DCE 하나
  panel.js      화면 오른쪽 아래 제어 패널 (Shadow DOM)
  collector.js  스크롤하며 수집 → 200개마다 storage에 저장
  navigator.js  채널 이동 + 대기열 실행 (Phase 2)
  parser.js     li 요소 → 메시지 객체
  diagnose.js   DOM 진단 리포트
  store.js      chrome.storage 읽기/쓰기
  selectors.js  모든 DOM 셀렉터 (디스코드가 바뀌면 여기만 수정)
        │  chrome.storage.local (작업 상태 + 메시지 청크)
        ▼
[export.html]     확장 페이지: 미리보기, 형식 선택, 파일 생성, 첨부 받기, ZIP, 저장
  exporters/      txt / json / csv / html — 순수 함수
[background.js]   아이콘 클릭 → 패널 토글, 패널 요청 → 내보내기 페이지 열기. 상태는 들고 있지 않는다.
```
- 제어 UI를 팝업이나 다른 탭이 아니라 **디스코드 페이지 위 패널**에 두는 이유: 디스코드 탭이 가려지면 렌더링과 타이머가 멈춰서 수집도 멈춘다.
- 파일 생성·ZIP·첨부 다운로드는 **export.html**에서 한다. 서비스 워커는 30초 쉬면 꺼지고 Blob URL을 만들 수 없다.

```
discord-exporter/
├─ CLAUDE.md
├─ manifest.json
├─ background.js
├─ content/    selectors.js parser.js store.js collector.js navigator.js diagnose.js panel.js
├─ export/     export.html export.css export.js
├─ exporters/  txt.js json.js csv.js html.js
├─ shared/     snowflake.js filename.js authors.js
├─ lib/        jszip.min.js (Phase 3)
├─ icons/      16.png 48.png 128.png
└─ tests/      *.test.mjs (node:test)
```

## 데이터
메시지 객체:
```js
{
  id: "1310...",          // 스노플레이크. 항상 문자열
  channelId: "...",
  timestamp: "2026-11-25T15:12:03.000Z",
  type: "default" | "reply" | "system",
  author: { id: "..." | null, name: "..." | null, avatarUrl: "..." | null },
  content: "본문",
  attachments: [{ name, url, type: "image" | "video" | "audio" | "file" }],
  embeds: [{ title, url, description }],
  stickers: ["이름"],
  reactions: [{ emoji: "👍", count: 3 }],
  replyTo: { id: "..." | null, author: "..." | null, snippet: "..." | null } | null,
  edited: false
}
```
- 묶음 안의 연속 메시지는 화면에 작성자가 없다. `author.name = null`로 저장하고, 내보낼 때 ID 순으로 정렬한 뒤 직전 메시지 작성자로 채운다(`shared/authors.js`).
- `author.id`는 아바타 주소의 `/avatars/<id>/` 또는 `/users/<id>/avatars/`에서 뽑는다. 기본 아바타면 null.

chrome.storage.local 키:

| 키 | 내용 |
|---|---|
| `dce:job` | 대기열 `{ items: [{ key, guildId, guildName, channelId, channelName, kind, url, status, count, error }], options, activeKey }` |
| `dce:meta:<channelId>` | `{ guildId, guildName, channelName, kind, count, chunkCount, oldestId, newestId, reachedStart, finishedAt }` |
| `dce:msgs:<channelId>:<n>` | 메시지 배열 (한 번에 저장하는 묶음, 최대 200개) |
| `dce:prefs` | 마지막으로 고른 형식·옵션 |

## 셀렉터
모든 셀렉터는 `content/selectors.js` 한 곳에 둔다. 아래는 **출발 가설**이고, Phase 0 진단 리포트로 확정한다. 리포트 없이 추측으로 확정하지 않는다.

| 대상 | 가설 |
|---|---|
| 메시지 목록 | `ol[data-list-id="chat-messages"]` |
| 스크롤 컨테이너 | 위 목록의 조상 중 실제로 스크롤되는 요소 (`scrollHeight > clientHeight`, `[class*="scroller"]`) |
| 메시지 | `li[id^="chat-messages-"]` → id = `chat-messages-<채널ID>-<메시지ID>` |
| 작성자 / 본문 / 첨부·임베드 / 답장 | `#message-username-<ID>` / `#message-content-<ID>` / `#message-accessories-<ID>` / `#message-reply-context-<ID>` |
| 시각 | li 안의 `time[datetime]` (ISO) |
| 사이드바 채널 | `a[href^="/channels/"]`, `[data-list-item-id^="channels___"]` |
| DM | `a[href^="/channels/@me/"]` |

- 본문·작성자·시각은 **그 메시지의 ID로 정확히** 찾는다. `[id^="message-content-"]`처럼 앞부분만 맞추면 답장 미리보기 안의 다른 메시지와 섞인다.
- 해시가 붙은 클래스(`messageContent_a1b2c`)는 통째로 쓰지 말고 `[class*="messageContent"]`처럼 앞부분만 쓴다.
- 화면 문구(aria-label, "환영합니다" 등)는 언어마다 다르다. 판단 근거로 쓰지 않고, 꼭 필요하면 한국어·영어 둘 다 selectors.js에 모은다.

## 알려진 함정
- **가상 스크롤**: 화면에는 일부 메시지만 있다. 스크롤할 때마다 보이는 li를 파싱하고 ID로 중복을 없앤다.
- **64비트 ID**: `Number`로 바꾸면 값이 깨진다. 문자열로 두고 비교·정렬은 `BigInt`로. 생성 시각(ms) = `(BigInt(id) >> 22n) + 1420070400000n`. 채널 ID로 채널 생성일을 알 수 있으니 진행률 계산에 쓴다.
- **가려진 탭**: 탭이 백그라운드거나 창이 최소화·완전히 가려지면 `requestAnimationFrame`이 멈추고 타이머가 크게 느려진다. `visibilitychange`로 자동 일시정지·재개하고 패널에 알린다.
- **본문 추출**: `innerText`만 쓰면 이모지(`img[alt]`)가 빠진다. 노드를 순회해 이모지는 alt로, 줄바꿈·코드블록은 유지하고, "(수정됨)" 표시 요소는 본문에서 빼고 `edited = true`.
- **content script**: ES module을 못 쓴다. manifest `js` 배열 순서대로 로드하고 전역은 `window.DCE` 하나에 모은다. `exporters/`·`shared/`·`export/`는 ES module이다. content에서 필요한 작은 함수(스노플레이크 계산 등)는 content 쪽에 따로 둬도 된다.
- **확장 다시 로드**: 이미 열려 있던 탭의 content script는 "Extension context invalidated" 오류를 낸다. 잡아서 "디스코드 탭을 새로고침해주세요"라고 안내한다.
- **패널 입력칸**: 키를 누르면 디스코드가 채팅 입력창으로 포커스를 가져간다. 패널 안의 `keydown`·`keypress`·`keyup`은 `stopPropagation`. 패널 스타일이 안 먹으면 페이지 CSP 문제일 수 있으니 `adoptedStyleSheets`를 쓴다.
- **메시지 전달**: `chrome.runtime` 메시지는 JSON만 된다. ArrayBuffer·Blob을 주고받지 않는다.
- **CORS**: content script의 fetch는 CORS에 막힌다. 첨부는 export.html(확장 출처 + host 권한)에서 fetch하거나 `chrome.downloads`로 받는다.
- **첨부 링크 만료**: CDN 주소에 서명(`ex`, `is`, `hm`)이 붙어 있고 약 24시간 뒤 만료된다. 오래된 수집분은 실패할 수 있으니 `failed.txt`에 남긴다.
- **파일명**: Windows 금지 문자 `\ / : * ? " < > |`, 끝의 점·공백, 예약어(CON, NUL, COM1…), 길이(경로 포함 200자 안쪽)를 처리한다. `chrome.downloads`의 filename은 다운로드 폴더 기준 상대경로만 된다.
- **CSV**는 UTF-8 BOM + RFC 4180 이스케이프. **HTML 출력**은 모든 텍스트를 이스케이프하고 `javascript:` 링크를 막는다.
- **속도**: 스크롤 간격 400~900ms 무작위, 30회마다 3~6초 휴식, 채널 사이 5~10초. 사람이 빠르게 스크롤하는 수준을 넘지 않는다.
- **웨일 호환**: `chrome.sidePanel`, `chrome.offscreen`은 쓰지 않는다.

## 작업 방식
- 시작 전에 바꿀 파일과 접근 방법을 짧게 보여준다.
- DOM 구조가 불확실하면 추측해서 짜지 말고 진단 리포트를 요청한다.
- 순수 함수(exporters, shared)는 `tests/`에 `node:test` 테스트를 만들고 `node --test`로 돌려 통과를 확인한다. Node가 없으면 그렇다고 알린다.
- 단계가 끝나면: 바뀐 파일 요약 → 웨일에서 확인할 체크리스트 → `git commit -m "phase N: ..."`.
- 사용자에게는 한국어로 답한다.
