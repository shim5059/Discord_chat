// 스크롤하며 메시지를 모아 200개마다 저장한다. 화면에 그려진 것만 읽고, 스크롤 말고는 아무것도 조작하지 않는다.
window.DCE = window.DCE || {};

(() => {
  const S = DCE.selectors;
  const CHUNK = 200;
  const WAIT_MS = 5000; // 새 메시지가 그려질 때까지 기다리는 시간
  const MAX_IDLE = 5; // 더 나오지 않는 상태가 이만큼 이어지면 끝낸다
  const MAX_IDLE_MORE = 12; // 회색 자리표시가 남아 있으면(옛 글이 더 있으면) 더 오래 시도한다
  const REST_EVERY = 30;

  // 옛 글을 더 불러오게 하는 스크롤 방법. 디스코드의 조건을 알 수 없어, 안 되면 다음 방법을 쓰고 된 방법을 기억한다.
  // 맨 위(회색 자리표시 안)로 바로 가면 아래쪽 글이 지워질 때 그 안에 갇혀 더 불러오지 않는다(2026-11-26, 143개에서 멈춤).
  //   down: 먼저 첫 메시지를 화면 높이의 몇 배만큼 위로 밀어 회색 자리표시에서 벗어난다
  //   up:   첫 메시지를 화면 위에서 화면 높이의 몇 배 되는 곳에 둔다. Infinity면 맨 위까지 올린다
  const WAYS = [
    { down: 0, up: 0.3 },
    { down: 0.8, up: 0.3 },
    { down: 0, up: 1 },
    { down: 0, up: Infinity },
    { down: 2, up: Infinity },
  ];

  let job = null; // 지금(또는 마지막) 수집
  let starting = false;
  let wake = () => {};

  const random = (min, max) => min + Math.random() * (max - min);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rest = (min, max) => Promise.race([sleep(random(min, max)), job.aborted]);
  const notify = () => DCE.collector.onChange();

  // 사람이 빠르게 스크롤하는 수준을 넘지 않는다.
  async function pace() {
    await rest(400, 900);
    if (++job.scrolls % REST_EVERY === 0) await rest(3000, 6000);
  }

  // ── 화면 읽기 ──

  function currentChannel() {
    const match = location.pathname.match(/^\/channels\/(@me|\d+)\/(\d+)/);
    return match && { guildId: match[1], channelId: match[2] };
  }

  // 스레드를 옆에 열면 목록이 둘이 된다. 수집하는 채널의 목록만 본다.
  const findList = (channelId) =>
    [...document.querySelectorAll(S.messageList)].find((list) =>
      list.querySelector(`${S.message}, ${S.channelStart}`)?.id.startsWith(`chat-messages-${channelId}-`),
    );

  const messages = (list) => [...list.querySelectorAll(S.message)];
  const idOf = (li) => DCE.messageIds(li).id;

  // 회색 자리표시가 첫 메시지 위에 있으면 더 오래된 글이, 마지막 메시지 아래에 있으면 더 새로운 글이 남아 있다.
  function hasMore(list, direction) {
    const edge = direction === 'above' ? messages(list)[0] : messages(list).at(-1);
    const side = direction === 'above' ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    return [...list.querySelectorAll(S.skeleton)].some((blob) => !edge || edge.compareDocumentPosition(blob) & side);
  }

  async function view() {
    const left = () => currentChannel()?.channelId !== job.channelId;
    await waitUntil(document.body, () => left() || findList(job.channelId), WAIT_MS);
    if (left()) throw new Error('다른 채널로 이동해서 멈췄어요. 모은 메시지는 저장했어요.');
    const list = findList(job.channelId);
    const scroller = list?.closest(S.scroller);
    if (!scroller) throw new Error('메시지 목록을 찾지 못해 멈췄어요. 모은 메시지는 저장했어요.');
    if (job.watched !== scroller) {
      job.watcher.disconnect();
      job.watcher.observe(scroller, { childList: true, subtree: true });
      job.watched = scroller;
    }
    return { list, scroller };
  }

  // target 아래가 바뀔 때마다 조건을 본다. 시간이 다 되거나 중지하면 그때의 결과를 돌려준다.
  function waitUntil(target, condition, ms) {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => condition() && finish());
      const timer = setTimeout(finish, ms);
      function finish() {
        observer.disconnect();
        clearTimeout(timer);
        resolve(Boolean(condition()));
      }
      observer.observe(target, { childList: true, subtree: true });
      job.aborted.then(finish);
      if (condition()) finish();
    });
  }

  // 일시정지했거나 창이 가려져 있으면 풀릴 때까지 기다린다.
  async function gate() {
    while (!job.stopped && (job.paused || document.hidden)) {
      notify();
      await new Promise((resolve) => {
        wake = resolve;
      });
    }
    notify();
  }

  // ── 저장 ──

  function parse(li) {
    try {
      return DCE.parseMessage(li);
    } catch (error) {
      // 하나를 못 읽어도 수집은 이어가고, 자리는 남겨 둔다.
      console.error('[DCE] 메시지를 읽지 못했어요.', error);
      job.failed++;
      const { channelId, id } = DCE.messageIds(li);
      return {
        id,
        channelId,
        timestamp: new Date(DCE.snowflakeTime(id)).toISOString(),
        type: 'default',
        author: { id: null, name: null, avatarUrl: null },
        content: '(읽지 못한 메시지)',
        attachments: [],
        embeds: [],
        stickers: [],
        reactions: [],
        replyTo: null,
        edited: false,
      };
    }
  }

  function take(li) {
    const { channelId, id } = DCE.messageIds(li);
    if (channelId !== job.channelId || job.seen.has(id)) return;
    job.seen.add(id);
    job.buffer.push(parse(li));
    if (!job.oldestId || BigInt(id) < BigInt(job.oldestId)) job.oldestId = id;
    if (!job.newestId || BigInt(id) > BigInt(job.newestId)) job.newestId = id;
  }

  // 더 불러올 때마다 새 범위는 앞의 범위와 겹친다. 답장을 눌러 옛 글로 건너뛰면 겹치지 않고 사이가 빈다.
  function follow(list) {
    const items = messages(list);
    if (!items.length) return;
    const oldest = BigInt(idOf(items[0]));
    const newest = BigInt(idOf(items.at(-1)));
    if (job.reach !== null && newest < job.reach) job.gaps++;
    if (job.reach === null || oldest < job.reach) job.reach = oldest;
  }

  async function save(list) {
    follow(list);
    messages(list).forEach(take);
    while (job.buffer.length >= CHUNK) await flush();
  }

  // 디스코드가 연달아 불러오며 화면에서 지우는 글을, 아직 안 읽었다면 지워지는 순간에 읽는다.
  function onListChange(records) {
    for (const node of records.flatMap((record) => [...record.removedNodes])) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches(S.message)) take(node);
      else node.querySelectorAll(S.message).forEach(take);
    }
    const list = findList(job.channelId);
    if (list) follow(list);
  }

  const pick = (a, b, smaller) => (!a || !b ? a ?? b : BigInt(a) < BigInt(b) === smaller ? a : b);

  async function flush(extra) {
    const chunk = job.buffer.slice(0, CHUNK);
    chunk.forEach((m) => job.stored.add(m.id));
    const meta = {
      ...job.meta,
      count: job.stored.size,
      oldestId: pick(job.meta.oldestId, job.oldestId, true),
      newestId: pick(job.meta.newestId, job.newestId, false),
      ...extra,
    };
    const items = { [DCE.store.metaKey(job.channelId)]: meta };
    if (chunk.length) items[DCE.store.chunkKey(job.channelId, meta.chunkCount++)] = chunk;
    await DCE.store.set(items);
    job.meta = meta;
    job.buffer.splice(0, chunk.length);
  }

  // ── 스크롤 ──

  // 안 읽은 글이 많으면 채널이 중간에서 열린다. 맨 아래까지 내려가며, 지나는 메시지도 모은다.
  async function goToBottom() {
    let settled = 0;
    let idle = 0;
    while (!job.stopped && settled < 2) {
      if (idle >= MAX_IDLE) throw new Error('최신 메시지까지 불러오지 못해 멈췄어요. 디스코드 탭을 새로고침한 뒤 다시 수집해주세요.');
      await gate();
      const { list, scroller } = await view();
      await save(list);
      const more = hasMore(list, 'below');
      const before = new Set(messages(list).map(idOf));
      const added = () => messages(findList(job.channelId) ?? list).filter((li) => !before.has(idOf(li))).length;
      const from = snapshot(list, scroller);
      const since = Date.now();
      job.interrupted = false;
      scroller.scrollTop = scroller.scrollHeight;
      await waitUntil(scroller, added, more ? WAIT_MS : 1000);
      trace(`아래로 +${added()}개 ${Date.now() - since}ms`, from, scroller);
      if (more || added() >= 10) {
        settled = 0;
        if (added()) idle = 0;
        else if (!job.interrupted) idle++;
      } else settled++;
      await pace();
    }
  }

  const offsetIn = (scroller, el) => el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;

  async function askForOlder(scroller, { down, up }) {
    // 첫 메시지가 화면 위에서 y만큼 떨어지게 하는 스크롤 위치
    const place = (y) => {
      const first = findList(job.channelId)?.querySelector(S.message);
      return first ? scroller.scrollTop + offsetIn(scroller, first) - y : 0;
    };
    const screen = scroller.clientHeight;
    if (down) {
      scroller.scrollTop = place(-down * screen);
      await rest(200, 300);
    }
    const target = up === Infinity ? 0 : Math.max(0, place(up * screen));
    // 위치가 그대로면 스크롤 이벤트가 생기지 않는다.
    if (Math.abs(scroller.scrollTop - target) < 1) {
      scroller.scrollTop = target + screen / 4;
      await rest(50, 80);
    }
    scroller.scrollTop = target;
  }

  async function climb() {
    const firstId = (list) => {
      const li = list.querySelector(S.message);
      return li && BigInt(idOf(li));
    };
    let idle = 0;
    while (!job.stopped) {
      await gate();
      if (job.stopped) return;
      const { list, scroller } = await view();
      await save(list);
      if (list.querySelector(S.channelStart)) {
        job.reachedStart = true;
        return;
      }
      const more = hasMore(list, 'above');
      if (idle >= (more ? MAX_IDLE_MORE : MAX_IDLE)) {
        job.reachedStart = !more;
        return;
      }

      const before = firstId(list);
      const older = () => {
        const now = findList(job.channelId);
        if (!now) return false;
        const id = firstId(now);
        return now.querySelector(S.channelStart) || (id !== null && (before === null || id < before));
      };
      const way = (job.way + idle) % WAYS.length;
      const from = snapshot(list, scroller);
      const since = Date.now();
      job.interrupted = false;
      await askForOlder(scroller, WAYS[way]);
      const loaded = await waitUntil(scroller, older, WAIT_MS);
      trace(`방법${way} ${loaded ? '불러옴' : '안 옴'} ${Date.now() - since}ms`, from, scroller);
      if (loaded) {
        job.way = way;
        idle = 0;
      } else if (!job.interrupted) idle++;
      await pace();
    }
  }

  // ── 진단용 기록 ── 내용 없이 스크롤 위치와 개수만 남긴다.

  function snapshot(list, scroller) {
    const items = messages(list);
    const y = (li) => (li ? Math.round(offsetIn(scroller, li)) : '-');
    const more = (hasMore(list, 'above') ? '↑' : '') + (hasMore(list, 'below') ? '↓' : '');
    return `${Math.round(scroller.scrollTop)}/${scroller.scrollHeight} ${items.length}개 y${y(items[0])}~${y(items.at(-1))}${more}`;
  }

  function trace(what, from, scroller) {
    const list = findList(job.channelId);
    const seconds = ((Date.now() - job.startedAt) / 1000).toFixed(1);
    job.trace.push(`${seconds}s ${what} | ${from} → ${list ? snapshot(list, scroller) : '목록 없음'}`);
    job.trace.splice(0, job.trace.length - 40);
  }

  // ── 시작과 끝 ──

  async function run() {
    let error = null;
    try {
      await goToBottom();
      await climb();
    } catch (e) {
      error = e;
    }
    job.watcher.disconnect();
    try {
      while (job.buffer.length) await flush();
      const done = !error && !job.stopped;
      if (job.stored.size) {
        await flush({
          reachedStart: job.meta.reachedStart || (job.reachedStart && !job.gaps),
          finishedAt: done ? new Date().toISOString() : job.meta.finishedAt,
        });
      }
    } catch (e) {
      error ??= e;
    }
    job.error = error;
    job.endedAt = Date.now();
    notify();
  }

  // 이미 저장된 메시지의 ID. 다시 수집해도 개수를 두 번 세지 않으려고 읽는다.
  async function storedIds(channelId, chunkCount) {
    const ids = new Set();
    for (let n = 0; n < chunkCount; n++) {
      for (const m of (await DCE.store.get(DCE.store.chunkKey(channelId, n))) ?? []) ids.add(m.id);
    }
    return ids;
  }

  async function prepare() {
    const where = currentChannel();
    if (!where || !findList(where.channelId)) throw new Error('채널이나 DM 대화를 연 뒤 눌러주세요.');

    // 저장소를 읽는 동안 채널을 바꿀 수 있으니 이름부터 읽어 둔다.
    const { guildId, channelId } = where;
    const name = (selector) => {
      const el = document.querySelector(selector);
      return el ? DCE.textOf(el) : '';
    };
    const names = { guildName: guildId === '@me' ? 'DM' : name(S.guildName), channelName: name(S.channelName) };
    const old = await DCE.store.get(DCE.store.metaKey(channelId));
    let abort;
    const aborted = new Promise((resolve) => {
      abort = resolve;
    });
    return {
      channelId,
      aborted,
      abort,
      startedAt: Date.now(),
      endedAt: null,
      paused: false,
      stopped: false,
      interrupted: false,
      reachedStart: false,
      scrolls: 0,
      way: 0,
      watcher: new MutationObserver(onListChange),
      watched: null,
      reach: null,
      trace: [],
      gaps: 0,
      failed: 0,
      error: null,
      oldestId: null,
      newestId: null,
      seen: new Set(),
      buffer: [],
      stored: await storedIds(channelId, old?.chunkCount ?? 0),
      meta: {
        chunkCount: 0,
        oldestId: null,
        newestId: null,
        reachedStart: false,
        finishedAt: null,
        ...old,
        guildId,
        ...names,
        kind: guildId === '@me' ? 'dm' : 'text',
      },
    };
  }

  async function start() {
    if (starting || (job && !job.endedAt)) return; // 두 번 눌러도 하나만
    starting = true;
    notify();
    try {
      job = await prepare();
    } finally {
      starting = false;
    }
    run();
    notify();
  }

  function status() {
    if (starting) return { state: 'starting' };
    if (!job) return { state: 'idle' };
    const now = job.endedAt ?? Date.now();
    const oldestTime = job.oldestId ? DCE.snowflakeTime(job.oldestId) : null;
    const span = now - DCE.snowflakeTime(job.channelId);
    let state = job.paused ? 'paused' : document.hidden ? 'hidden' : 'running';
    if (job.endedAt) state = job.error ? 'error' : job.stopped ? 'stopped' : 'done';
    return {
      state,
      count: job.seen.size,
      oldestTime,
      progress: job.reachedStart ? 1 : oldestTime ? Math.min(1, Math.max(0, (now - oldestTime) / span)) : 0,
      elapsed: now - job.startedAt,
      reachedStart: job.reachedStart,
      gaps: job.gaps,
      failed: job.failed,
      error: job.error?.message,
    };
  }

  function update(change) {
    if (!job || job.endedAt) return;
    Object.assign(job, change, { interrupted: true });
    wake();
    notify();
  }

  document.addEventListener('visibilitychange', () => update({}));

  DCE.collector = {
    onChange: () => {}, // 패널이 열려 있을 때 상태를 다시 그리는 함수
    start,
    status,
    trace: () => job?.trace,
    pause: () => update({ paused: true }),
    resume: () => update({ paused: false }),
    stop: () => {
      update({ stopped: true });
      job?.abort();
    },
  };
})();
