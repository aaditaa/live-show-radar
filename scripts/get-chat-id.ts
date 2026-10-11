import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

/**
 * Prints the chat ID to put in TELEGRAM_CHAT_ID.
 *
 * Send /start to your bot in Telegram first — getUpdates only returns chats
 * that have messaged the bot.
 */
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set (put it in .env.local)');

  const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
  if (!me.ok) throw new Error(`getMe failed: ${me.description}`);
  console.log(`Bot: @${me.result.username}\n`);

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const body = await res.json();
  if (!body.ok) throw new Error(`getUpdates failed: ${body.description}`);

  const chats = new Map<number, { title: string; type: string }>();
  for (const update of body.result ?? []) {
    const chat = update.message?.chat ?? update.channel_post?.chat;
    if (!chat) continue;
    const title =
      chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ') ?? chat.username;
    chats.set(chat.id, { title: title ?? '(unnamed)', type: chat.type });
  }

  if (chats.size === 0) {
    console.log('No chats found yet.');
    console.log(`Open Telegram, find @${me.result.username}, send /start, then run this again.`);
    console.log('(Telegram only keeps updates for 24 hours.)');
    return;
  }

  console.log('Chats that have messaged this bot:\n');
  for (const [id, chat] of chats) {
    console.log(`  TELEGRAM_CHAT_ID=${id}    ${chat.title} (${chat.type})`);
  }
  console.log('\nCopy the line for your own chat into .env.local.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
