"use server";

const jensBot = process.env.TELEGRAM_CHAT_ID;
const token = process.env.TELEGRAM_BOT_TOKEN;

export const sendTelegramMessage = async (
  msg: string,
  chatId = jensBot,
  markdown = true
): Promise<Response> => {
  console.log(msg);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: markdown ? "Markdown" : undefined,
    }),
  });
  if (!res.ok && markdown) {
    console.log("Failed to send message, trying again without markdown");
    return sendTelegramMessage(msg, chatId, false);
  }
  return res;
};
