import 'dotenv/config';
import consola from 'consola';
import { OAuth2Authenticator, Client, StreamWatcher, EventType, EventReason } from 'mixi2-js';

const { CLIENT_ID, CLIENT_SECRET, TOKEN_URL, API_ADDRESS, STREAM_ADDRESS, AUTH_KEY } = process.env;

if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_URL || !API_ADDRESS || !STREAM_ADDRESS) {
  consola.error('必要な環境変数が設定されていません。.env.example を参考に .env を作成してください。');
  process.exit(1);
}

const authenticator = new OAuth2Authenticator({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  tokenUrl: TOKEN_URL,
});

const client = new Client({
  apiAddress: API_ADDRESS,
  authenticator,
  authKey: AUTH_KEY,
});

const watcher = new StreamWatcher({
  streamAddress: STREAM_ADDRESS,
  authenticator,
  authKey: AUTH_KEY,
});

// おみくじの結果定義
const fortunes = [
  { result: '🎊 大吉', message: '最高の一日！' },
  { result: '🌸 吉', message: '良い一日になりそう。' },
  { result: '🍀 中吉', message: 'まずまずの運勢。' },
  { result: '🌱 小吉', message: '小さな幸運あり。' },
  { result: '🌙 末吉', message: 'これから上昇運。' },
  { result: '🌧️ 凶', message: '慎重に過ごそう。' },
  { result: '⛈️ 大凶', message: 'あとは上がるだけ！' },
];

function drawFortune() {
  return fortunes[Math.floor(Math.random() * fortunes.length)];
}

const RECONNECT_INTERVAL_MS = 5000;

async function startWatching() {
  consola.info('🎋 おみくじBotを起動中...');

  try {
    await watcher.watch({
      async handle(event) {
        if (event.eventType !== EventType.POST_CREATED) return;

        const postEvent = event.postCreatedEvent;
        if (!postEvent) return;

        // メンションイベントのみ処理
        if (!postEvent.eventReasonList.includes(EventReason.POST_MENTIONED)) return;

        const post = postEvent.post;
        const issuer = postEvent.issuer;
        if (!post) return;

        const fortune = drawFortune();
        const text = `🎋 おみくじ結果\n\n${fortune.result}\n${fortune.message}`;

        try {
          await client.createPost({
            text,
            inReplyToPostId: post.postId,
          });
          consola.success(`${issuer?.displayName ?? '不明'} さんにおみくじ結果を返信しました: ${fortune.result}`);
        } catch (err) {
          consola.error('返信の送信に失敗しました:', err);
        }
      },
    });
    consola.warn('ストリーム接続が終了しました。再接続します...');
  } catch (err) {
    consola.error('ストリーム接続エラー:', err);
  }

  setTimeout(startWatching, RECONNECT_INTERVAL_MS);
}

startWatching();

// graceful shutdown
process.on('SIGINT', () => {
  consola.log('\n');
  consola.info('Botを停止中...');
  watcher.stop();
  client.close();
  process.exit(0);
});
