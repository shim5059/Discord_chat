// messages는 정렬과 작성자 채우기가 끝난 것이어야 한다.
export function toJson(messages, { guildId, guildName, channelId, channelName }, exportedAt) {
  return JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      source: { guildId, guildName, channelId, channelName, url: `https://discord.com/channels/${guildId}/${channelId}` },
      messageCount: messages.length,
      range: { from: messages[0]?.timestamp ?? null, to: messages.at(-1)?.timestamp ?? null },
      messages,
    },
    null,
    2,
  );
}
