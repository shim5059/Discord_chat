// 저장된 채널을 골라 파일로 내보내는 확장 페이지
import { toJson } from '../exporters/json.js';
import { toTxt } from '../exporters/txt.js';
import { fillAuthors } from '../shared/authors.js';
import { exportFilename, localDate } from '../shared/filename.js';
import { snowflakeTime, sortUnique } from '../shared/snowflake.js';

const META = 'dce:meta:';
const $ = (selector) => document.querySelector(selector);
const buttons = document.querySelectorAll('[data-format]');
let channels = [];
let selectedId = null;

// 메시지까지 통째로 읽지 않도록 키 목록에서 채널 정보만 골라 읽는다.
async function loadChannels() {
  const keys = (await chrome.storage.local.getKeys()).filter((key) => key.startsWith(META));
  const metas = keys.length ? await chrome.storage.local.get(keys) : {};
  return Object.entries(metas).map(([key, meta]) => ({ channelId: key.slice(META.length), ...meta }));
}

async function loadMessages({ channelId, chunkCount }) {
  const all = [];
  for (let n = 0; n < chunkCount; n++) {
    const key = `dce:msgs:${channelId}:${n}`;
    all.push(...((await chrome.storage.local.get(key))[key] ?? []));
  }
  return fillAuthors(sortUnique(all));
}

const period = ({ oldestId, newestId }) =>
  oldestId ? `${localDate(new Date(snowflakeTime(oldestId)))} ~ ${localDate(new Date(snowflakeTime(newestId)))}` : '';

function row(channel) {
  const radio = Object.assign(document.createElement('input'), {
    type: 'radio',
    name: 'channel',
    value: channel.channelId,
    checked: channel.channelId === selectedId,
  });
  const label = document.createElement('label');
  label.append(radio, channel.guildName);
  const cells = [label, channel.channelName, channel.count.toLocaleString(), period(channel), channel.reachedStart ? '다 모음' : '아직'];
  const tr = document.createElement('tr');
  tr.append(
    ...cells.map((cell) => {
      const td = document.createElement('td');
      td.append(cell);
      return td;
    }),
  );
  return tr;
}

async function render() {
  channels = await loadChannels();
  $('#empty').hidden = channels.length > 0;
  $('#channels').hidden = $('#actions').hidden = channels.length === 0;
  $('#channels tbody').replaceChildren(...channels.map(row));
}

async function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  try {
    const id = await chrome.downloads.download({ url, filename });
    await new Promise((resolve) => {
      chrome.downloads.onChanged.addListener(function done(change) {
        if (change.id !== id || !['complete', 'interrupted'].includes(change.state?.current)) return;
        chrome.downloads.onChanged.removeListener(done);
        resolve();
      });
    });
    const [item] = await chrome.downloads.search({ id });
    if (item.state !== 'complete') throw new Error(item.error);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function exportChannel(format) {
  const channel = channels.find((c) => c.channelId === selectedId);
  const now = new Date();
  const filename = exportFilename(channel.guildName, channel.channelName, now, format);
  $('#status').textContent = '파일을 만들고 있어요.';
  buttons.forEach((b) => (b.disabled = true));
  try {
    const messages = await loadMessages(channel);
    if (format === 'txt') await download(toTxt(messages), 'text/plain;charset=utf-8', filename);
    else await download(toJson(messages, channel, now), 'application/json', filename);
    $('#status').textContent = `메시지 ${messages.length.toLocaleString()}개를 저장했어요: ${filename}`;
  } catch (error) {
    $('#status').textContent = `저장하지 못했어요. ${error.message}`;
  }
  buttons.forEach((b) => (b.disabled = false));
}

$('#channels').addEventListener('change', (event) => {
  selectedId = event.target.value;
  buttons.forEach((b) => (b.disabled = false));
});
buttons.forEach((b) => b.addEventListener('click', () => exportChannel(b.dataset.format)));

// 수집하는 동안 개수가 늘어나는 것을 바로 보여준다.
chrome.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).some((key) => key.startsWith(META))) render();
});
render();
