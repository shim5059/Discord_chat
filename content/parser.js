// 메시지 li 요소 → 메시지 객체. 형식은 CLAUDE.md의 스키마를 따른다.
window.DCE = window.DCE || {};

(() => {
  const S = DCE.selectors;
  const BLOCK = /^(div|p|ul|ol|li|h[1-6]|blockquote)$/;
  const MEDIA = [
    ['image', /\.(png|jpe?g|gif|webp|avif|bmp|heic)$/i],
    ['video', /\.(mp4|webm|mov|mkv)$/i],
    ['audio', /\.(mp3|ogg|wav|m4a|flac|opus)$/i],
  ];

  // 주소에 깨진 % 표기가 있으면 풀지 않고 그대로 쓴다.
  function decode(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }

  // 보이는 글자만 뽑는다. 이모지는 alt로, 줄바꿈과 코드블록은 유지한다.
  function textOf(root, { links = false, skipTime = false } = {}) {
    let out = '';
    const newline = () => {
      if (out && !out.endsWith('\n')) out += '\n';
    };
    (function walk(parent) {
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          out += node.data;
          continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE || node.matches(S.hiddenText)) continue;
        // (수정됨)은 본문이 아니다. 사용자가 본문에 넣은 시각은 남긴다.
        if (node.matches(S.timeMark) && (skipTime || node.querySelector(S.edited))) continue;

        const tag = node.localName;
        if (tag === 'svg') continue;
        if (tag === 'img') out += node.alt;
        else if (tag === 'br') out += '\n';
        else if (node.matches(S.codeBlock)) {
          const code = node.querySelector(S.codeText);
          const language = code?.className.match(/language-(\S+)/)?.[1] ?? '';
          newline();
          out += `\`\`\`${language}\n${(code ?? node).textContent.replace(/\n$/, '')}\n\`\`\`\n`;
        } else if (tag === 'a' && links && /^https?:/.test(node.href)) {
          const start = out.length;
          walk(node);
          // 글자에 주소를 숨긴 링크는 주소도 함께 남긴다.
          const plain = (s) => decode(s).replace(/\/$/, '');
          if (plain(out.slice(start)) !== plain(node.href)) out += ` (${node.href})`;
        } else {
          if (BLOCK.test(tag)) newline();
          walk(node);
          if (BLOCK.test(tag)) newline();
        }
      }
    })(root);
    return out.trim();
  }

  DCE.textOf = textOf;

  const textOrNull = (el) => (el ? textOf(el) || null : null);
  const nameOf = (el) => el.dataset.text || el.textContent;

  function authorOf(li, id) {
    const name = li.querySelector(S.username(id))?.querySelector(S.usernameText);
    if (!name) return { id: null, name: null, avatarUrl: null };
    const avatarUrl = li.querySelector(S.avatar)?.src ?? null;
    const match = avatarUrl?.match(/\/users\/(\d+)\/avatars\/|\/avatars\/(\d+)\//);
    return { id: match?.[1] ?? match?.[2] ?? null, name: nameOf(name), avatarUrl };
  }

  function attachmentsOf(accessories) {
    const byPath = new Map();
    for (const el of accessories.querySelectorAll(S.attachment)) {
      const url = el.href ?? el.src;
      const { pathname } = new URL(url);
      if (byPath.has(pathname)) continue; // 영상은 source와 다운로드 링크에 같은 주소가 있다.
      const name = decode(pathname.split('/').pop());
      byPath.set(pathname, { name, url, type: MEDIA.find(([, ext]) => ext.test(name))?.[0] ?? 'file' });
    }
    return [...byPath.values()];
  }

  function embedOf(el) {
    const link = el.matches(S.gif) ? el.querySelector(S.gifLink) : el.querySelector(S.embedTitleLink);
    return {
      title: textOrNull(el.querySelector(S.embedTitle)),
      url: link?.href ?? null,
      description: textOrNull(el.querySelector(S.embedDescription)),
    };
  }

  function reactionOf(el) {
    return {
      emoji: el.querySelector(S.emoji)?.alt ?? '',
      count: Number(el.querySelector(S.reactionCount)?.textContent.replace(/\D/g, '') || 0),
    };
  }

  function replyOf(context) {
    const author = context.querySelector(S.usernameText);
    const original = context.querySelector(S.repliedContent);
    return {
      id: original?.id.match(/\d+$/)?.[0] ?? null,
      author: author ? nameOf(author).replace(/^@/, '') : null,
      snippet: original ? textOf(original) : textOrNull(context),
    };
  }

  // chat-messages-<채널ID>-<메시지ID>
  DCE.messageIds = (li) => {
    const [, channelId, id] = li.id.match(/^chat-messages-(\d+)-(\d+)$/);
    return { channelId, id };
  };

  DCE.snowflakeTime = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

  DCE.parseMessage = (li) => {
    const { channelId, id } = DCE.messageIds(li);
    const content = li.querySelector(S.content(id));
    const accessories = li.querySelector(S.accessories(id));
    const reply = li.querySelector(S.replyContext(id));
    const system = li.querySelector(`:scope > ${S.systemMessage}`) !== null;
    const time = li.querySelector(S.timestamp(id)) ?? li.querySelector(S.time);
    const all = (root, selector) => (root ? [...root.querySelectorAll(selector)] : []);

    return {
      id,
      channelId,
      timestamp: time?.dateTime || new Date(DCE.snowflakeTime(id)).toISOString(),
      type: system ? 'system' : reply ? 'reply' : 'default',
      author: authorOf(li, id),
      content: content ? textOf(content, { links: true, skipTime: system }) : '',
      attachments: accessories ? attachmentsOf(accessories) : [],
      embeds: all(accessories, S.embed).map(embedOf),
      stickers: all(accessories, S.sticker).map((el) => el.getAttribute('alt') || el.getAttribute('aria-label') || '(이름 없음)'),
      reactions: all(li.querySelector(S.reactions(id)), S.reaction).map(reactionOf),
      replyTo: reply ? replyOf(reply) : null,
      edited: content?.querySelector(S.edited) != null,
    };
  };
})();
