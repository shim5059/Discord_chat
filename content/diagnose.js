// DOM 진단: 지금 화면의 구조를 JSON으로 뽑는다. 셀렉터를 확정할 근거로만 쓴다.
// 실제 내용이 새지 않게, 허용 목록에 있는 것만 그대로 두고 나머지는 「n자」로 가린다.
window.DCE = window.DCE || {};

(() => {
  const S = DCE.selectors;
  const MAX_BYTES = 60 * 1024;
  // [자손 깊이, HTML 조각 하나의 글자 수]. 60KB를 넘으면 다음 단계로 줄여 다시 만든다.
  const LIMITS = [[6, 6000], [6, 3000], [5, 2000], [4, 1000], [2, 400], [1, 150]];
  // 드문 종류부터 골라야 흔한 종류의 표본으로 먼저 쓰이지 않는다.
  const KINDS = ['시스템 메시지', '임베드', '답장', '첨부', '연속 메시지', '묶음 첫 메시지'];

  // ── 가리기 ──

  const words = (s) => new Set(s.split(' '));
  const DISCORD_HOST = /(^|\.)(discord\.com|discord\.gg|discordapp\.(com|net))$/;
  const PATH_WORDS = words('channels @me attachments ephemeral-attachments avatars users guilds icons emojis stickers external embed assets banners role-icons channel-icons https http');
  const PARAMS = words('ex is hm size width height format quality animated passthrough');
  const FILE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|mp3|ogg|wav|m4a|flac|pdf|zip|txt)$/i;
  const LABEL_WORDS = words('discord 채널 텍스트 음성 공지 스테이지 포럼 미디어 스레드 카테고리 다이렉트 메시지 그룹 읽지 않음 않은 안 읽음 멘션 비공개 제한 규칙 스토어 channel text voice announcement news stage forum media thread category direct message group unread mention mentions private limited rules store');
  const ID_ATTRS = /^(id|for|data-list-id|data-list-item-id|aria-(labelledby|describedby|controls|owns))$/;
  const URL_ATTRS = /^(href|src|poster)$/;
  const SAFE_ATTRS = /^(role|type|tabindex|lang|dir|target|rel|width|height|aria-(hidden|expanded|selected|level|setsize|posinset|live|haspopup|busy|disabled|current|modal))$/;

  function maskText(s) {
    const length = [...s.trim()].length;
    return length ? `「${length}자」` : '';
  }

  // id와 클래스는 디스코드 코드가 정하는 영문 이름이라 남긴다. 영문이 아니면 내용일 수 있어 가린다.
  const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);
  const maskName = (s) => (isAscii(s) ? s : maskText(s));
  const maskId = (s) => (isAscii(s) ? s.replace(/\d+/g, '{id}') : maskText(s));

  // message__5126c, wrapper_c19a55 → message, wrapper
  const classPrefix = (c) => maskName(c.replace(/_{1,2}[0-9a-f]{5,6}$/, ''));

  function maskSegment(segment) {
    if (!segment || PATH_WORDS.has(segment)) return segment;
    const ext = segment.match(FILE_EXT)?.[0] ?? '';
    const name = segment.slice(0, segment.length - ext.length);
    if (/^\d+$/.test(name)) return `{id}${ext}`;
    if (/^(a_)?[0-9a-f]{16,}$/i.test(name)) return `{hash}${ext}`;
    return maskText(name) + ext;
  }

  function maskUrl(raw) {
    let url;
    try {
      url = new URL(raw, location.origin);
    } catch {
      return '(주소 아님)';
    }
    if (!/^https?:$/.test(url.protocol)) return url.protocol;
    if (!DISCORD_HOST.test(url.hostname)) return '{외부 주소}';
    const host = url.origin === location.origin ? '' : url.hostname;
    const path = url.pathname.split('/').map(maskSegment).join('/');
    const params = [...url.searchParams.keys()].filter((key) => PARAMS.has(key));
    return host + path + (params.length ? `?${params.join('&')}` : '');
  }

  const maskWords = (s) =>
    s.replace(/[^\s()[\],.:;|#@]+/g, (w) => (LABEL_WORDS.has(w.toLowerCase()) ? w : maskText(w)));

  // 이름은 지우고 "텍스트 채널"처럼 종류를 알려주는 말만 남긴다.
  function maskLabel(label, names) {
    if (!label) return label;
    const name = names.filter((n) => label.includes(n)).sort((a, b) => b.length - a.length)[0];
    return name ? label.split(name).map(maskWords).join(maskText(name)) : maskWords(label);
  }

  DCE.mask = { text: maskText, id: maskId, classPrefix, url: maskUrl, label: maskLabel, words: maskWords };

  // ── DOM 요약 ──

  const classes = (el) => [...new Set([...el.classList].map(classPrefix))];
  const sig = (el) => el.localName + (el.id ? `#${maskId(el.id)}` : '') + classes(el).map((c) => `.${c}`).join('');

  function pathFrom(root, el, max = Infinity) {
    const path = [];
    for (let n = el; n && n !== root && path.length < max; n = n.parentElement) path.unshift(sig(n));
    return path.join(' > ');
  }

  function texts(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const found = [];
    while (walker.nextNode()) found.push(walker.currentNode.data.trim());
    return found.filter(Boolean);
  }

  // 아이콘은 글자가 아니라 도형이라, path의 앞부분을 종류 구분용 지문으로 쓴다.
  function iconOf(svg) {
    const paths = [...svg.querySelectorAll('[d]')].map((p) => p.getAttribute('d'));
    return paths.length ? `${paths[0].slice(0, 24)} (path ${paths.length}개)` : '(path 없음)';
  }

  function maskAttr(el, { name, value }) {
    if (name === 'class') return `class='${classes(el).join(' ')}'`;
    if (name === 'style' || name.startsWith('on')) return '';
    if (name === 'datetime') return `datetime='${value.replace(/\d/g, '0')}'`;
    if (ID_ATTRS.test(name)) return `${name}='${maskId(value)}'`;
    if (URL_ATTRS.test(name)) return `${name}='${maskUrl(value)}'`;
    if (SAFE_ATTRS.test(name) || /^(true|false|)$/.test(value)) return value ? `${name}='${value}'` : name;
    return `${name}='${maskText(value)}'`;
  }

  function outline(node, depth) {
    if (node.nodeType === Node.TEXT_NODE) return maskText(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.localName;
    if (tag === 'svg') return `<svg icon='${iconOf(node)}'/>`;
    const open = [tag, ...[...node.attributes].map((a) => maskAttr(node, a))].filter(Boolean).join(' ');
    if (!node.childNodes.length) return `<${open}/>`;
    const inner = depth > 0 ? [...node.childNodes].map((c) => outline(c, depth - 1)).join('') : '…';
    return `<${open}>${inner}</${tag}>`;
  }

  const clip = (html, cap) => (html.length > cap ? `…(잘림)` : html);

  function tally(values, max) {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]).slice(0, max));
  }

  // 묶음마다 하나씩, 아직 안 나온 클래스가 가장 많은 요소를 고른다.
  function pickDiverse(pools, max) {
    const picked = [];
    const seen = new Set();
    const shapes = new Map();
    const shape = (el) => {
      if (!shapes.has(el)) shapes.set(el, new Set([el, ...el.querySelectorAll('*')].flatMap(classes)));
      return shapes.get(el);
    };
    for (const pool of pools) {
      if (picked.length >= max) break;
      let best = null;
      let bestScore = -1;
      for (const el of pool) {
        if (picked.includes(el)) continue;
        const score = [...shape(el)].filter((c) => !seen.has(c)).length;
        if (score > bestScore) [best, bestScore] = [el, score];
      }
      if (!best) continue;
      picked.push(best);
      shape(best).forEach((c) => seen.add(c));
    }
    return picked;
  }

  // ── 메시지 목록 ──

  // 실제로 스크롤되는 조상까지 올라간다.
  function scrollChain(el) {
    const chain = [];
    for (let n = el; n; n = n.parentElement) {
      const { overflowY } = getComputedStyle(n);
      const { scrollHeight, clientHeight, scrollTop } = n;
      chain.push({ el: sig(n), overflowY, scrollHeight, clientHeight, scrollTop: Math.round(scrollTop) });
      if (/auto|scroll|overlay/.test(overflowY) && scrollHeight > clientHeight) return { chain, scroller: n };
    }
    return { chain, scroller: null };
  }

  const messageId = (li) => li.id.match(/\d+(?=\D*$)/)?.[0];

  function kindsOf(li) {
    const id = messageId(li);
    const has = (selector) => li.querySelector(selector) !== null;
    const accessories = li.querySelector(S.accessories(id));
    const system = has(S.systemMessage) || !(has(S.content(id)) || has(S.username(id)));
    const is = {
      '시스템 메시지': system,
      '임베드': accessories?.querySelector(S.embed),
      '답장': has(S.replyContext(id)),
      '첨부': accessories?.querySelector(S.attachment),
      '연속 메시지': !system && !has(S.username(id)),
      '묶음 첫 메시지': !system && has(S.username(id)),
    };
    return KINDS.filter((kind) => is[kind]);
  }

  function messageSample(li, depth, cap) {
    const urls = [...li.querySelectorAll('img, video, source, audio, a')]
      .map((el) => [el.localName, el.getAttribute('href') ?? el.getAttribute('src') ?? el.getAttribute('poster')])
      .filter(([, url]) => url)
      .map(([tag, url]) => `${tag} ${maskUrl(url)}`);
    return {
      kinds: kindsOf(li),
      li: sig(li),
      ids: Object.keys(tally([...li.querySelectorAll('[id]')].map((el) => maskId(el.id)), 20)),
      times: [...li.querySelectorAll(S.time)].slice(0, 4).map((t) => pathFrom(li, t)),
      urls: Object.keys(tally(urls, 12)),
      html: clip(outline(li, depth), cap),
    };
  }

  // 첫(마지막) 메시지보다 앞(뒤)에 있는 요소. 채널 시작 영역이나 로딩 표시가 여기 있다.
  function around(message, stop, direction, cap) {
    const found = [];
    for (let n = message; n && n !== stop; n = n.parentElement) {
      for (let s = n[direction]; s; s = s[direction]) found.push(s);
    }
    return found.slice(0, 8).map((el) => ({ parent: sig(el.parentElement), html: clip(outline(el, 3), cap) }));
  }

  function checkSelectors(items) {
    const count = (selector) =>
      typeof selector === 'string'
        ? document.querySelectorAll(selector).length
        : `${items.filter((li) => li.querySelector(selector(messageId(li)))).length}/${items.length}`;
    return Object.fromEntries(Object.entries(S).map(([name, selector]) => [name, count(selector)]));
  }

  // ── 사이드바 ──

  const rowOf = (el) => el.closest('li') ?? el;

  function channelClue(el) {
    const href = el.getAttribute('href');
    const icon = el.querySelector('svg');
    return {
      href: href && maskUrl(href),
      listItemId: maskId(el.getAttribute('data-list-item-id') ?? ''),
      role: el.getAttribute('role'),
      expanded: el.getAttribute('aria-expanded'),
      label: maskLabel(el.getAttribute('aria-label'), texts(el)),
      svg: icon && iconOf(icon),
    };
  }

  function categoryRow(el) {
    let n = rowOf(el);
    while ((n = n.previousElementSibling ?? n.parentElement)) {
      if (!n.querySelector(S.channelLink) && n.querySelector(S.categoryHeader)) return n;
    }
    return null;
  }

  function sidebar(list, cap) {
    const items = [...document.querySelectorAll(`${S.channelLink}, ${S.channelItem}`)].filter((el) => !list?.contains(el));
    if (!items.length) return { count: 0 };

    const groups = new Map();
    for (const el of items) {
      const key = JSON.stringify(channelClue(el)).replace(/「\d+자」/g, '「…」');
      if (!groups.has(key)) groups.set(key, { el, count: 0 });
      groups.get(key).count++;
    }
    const kinds = [...groups.values()];
    const samples = [...new Set([...kinds.map((k) => k.el), ...items])].slice(0, 15);

    return {
      count: items.length,
      scroll: scrollChain(rowOf(items[0]).parentElement).chain,
      // 텍스트·공지·음성·포럼 채널을 구분할 단서. 단서가 같은 항목끼리 묶었다.
      kinds: kinds.slice(0, 25).map(({ el, count }) => ({
        count,
        ...channelClue(el),
        path: pathFrom(rowOf(el).parentElement, el),
        svgs: [...el.querySelectorAll('svg')].slice(0, 4).map(iconOf),
        innerLabels: [...el.querySelectorAll('[aria-label]')].slice(0, 4).map((n) => maskLabel(n.getAttribute('aria-label'), texts(el))),
      })),
      samples: samples.map((el) => ({ ...channelClue(el), category: maskText(categoryRow(el)?.textContent ?? '') })),
      categoryRows: [...new Set(samples.map(categoryRow))].filter(Boolean).slice(0, 3).map((row) => clip(outline(row, 4), cap)),
    };
  }

  function dmList(list, cap) {
    const links = [...document.querySelectorAll(S.dmLink)].filter((el) => !list?.contains(el));
    return {
      count: links.length,
      samples: pickDiverse(Array(4).fill(links), 4).map((el) => ({ ...channelClue(el), html: clip(outline(el, 5), cap) })),
    };
  }

  // ── 리포트 ──

  function build(depth, cap) {
    const lists = document.querySelectorAll(S.messageList);
    const list = lists[0];
    const items = list ? [...list.querySelectorAll(S.message)] : [];
    const inside = list ? [list, ...list.querySelectorAll('*')] : [];
    const { chain, scroller } = scrollChain(list);
    const stop = scroller ?? list?.parentElement;
    const pools = KINDS.map((kind) => items.filter((li) => kindsOf(li).includes(kind)));

    return {
      version: chrome.runtime.getManifest().version,
      outlineDepth: depth,
      page: {
        path: maskUrl(location.pathname),
        lang: document.documentElement.lang,
        title: maskWords(document.title),
        userAgent: navigator.userAgent,
      },
      selectorCheck: checkSelectors(items),
      messageList: {
        found: lists.length,
        ol: list && outline(list, 0),
        messages: items.length,
        scroll: chain,
        atTop: scroller && scroller.scrollTop <= 1,
        atBottom: scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
        // 목록을 못 찾았을 때 대신 쓸 후보
        candidates: list ? undefined : Object.keys(tally([...document.querySelectorAll('ol, [data-list-id]')].map((el) => outline(el, 0)), 10)),
      },
      above: around(items[0], stop, 'previousElementSibling', cap),
      below: around(items.at(-1), stop, 'nextElementSibling', cap),
      samples: pickDiverse([...pools, ...Array(6).fill(items)], 6).map((li) => messageSample(li, depth, cap)),
      ids: tally(inside.filter((el) => el.id).map((el) => maskId(el.id)), 40),
      classes: tally(inside.flatMap(classes), 150),
      sidebar: sidebar(list, cap),
      dm: location.pathname.startsWith('/channels/@me') ? dmList(list, cap) : undefined,
      // 서버·채널 이름이 있을 만한 제목의 위치
      headings: tally(
        [...document.querySelectorAll('h1, h2, h3')]
          .filter((el) => !list?.contains(el) && !el.closest(S.channelItem))
          .map((el) => pathFrom(null, el, 5)),
        12,
      ),
    };
  }

  DCE.diagnose = () => {
    let json;
    for (const [depth, cap] of LIMITS) {
      // 마지막 안전장치: 혹시 남은 긴 숫자(디스코드 ID)는 여기서 지운다.
      json = JSON.stringify(build(depth, cap), null, 1).replace(/\d{15,}/g, '{id}');
      if (DCE.byteLength(json) <= MAX_BYTES) break;
    }
    return json;
  };

  DCE.byteLength = (s) => new TextEncoder().encode(s).length;
})();
