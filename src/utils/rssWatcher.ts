import Parser from 'rss-parser';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import fs from 'fs';
import { Client, TextChannel, EmbedBuilder, ChannelType } from 'discord.js';
import { RSSItem, CacheData, BotConfig } from '../types/config';

const parser = new Parser();
let seenItems: CacheData = {};
const CACHE_FILE = './rss-cache.json';
const CONFIG_FILE = './config.json';
const MAX_ITEMS_PER_FEED = 10;
const INITIAL_ITEMS_TO_SEND = 3;
let cronJob: ScheduledTask | null = null;

export function loadConfig(): BotConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Lỗi khi đọc config:', (error as Error).message);
  }

  return {
    feedChannelId: null,
    rssFeeds: [],
    checkIntervalMinutes: 10,
  };
}

export function saveConfig(config: BotConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('✓ Đã lưu config');
  } catch (error) {
    console.error('Lỗi khi lưu config:', (error as Error).message);
  }
}

function loadCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      seenItems = JSON.parse(data);
      const totalItems = Object.values(seenItems).reduce(
        (sum, items) => sum + items.length,
        0
      );
      console.log(
        `✓ Đã load cache: ${
          Object.keys(seenItems).length
        } nguồn, ${totalItems} bài`
      );
    }
  } catch (error) {
    console.error('Lỗi khi đọc cache:', (error as Error).message);
    seenItems = {};
  }
}

function saveCache(): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(seenItems, null, 2), 'utf8');
  } catch (error) {
    console.error('Lỗi khi lưu cache:', (error as Error).message);
  }
}

function addToCache(feedUrl: string, item: RSSItem): void {
  if (!seenItems[feedUrl]) {
    seenItems[feedUrl] = [];
  }

  seenItems[feedUrl].unshift(item);

  if (seenItems[feedUrl].length > MAX_ITEMS_PER_FEED) {
    seenItems[feedUrl] = seenItems[feedUrl].slice(0, MAX_ITEMS_PER_FEED);
  }
}

function isItemSeen(feedUrl: string, link: string): boolean {
  if (!seenItems[feedUrl]) {
    return false;
  }
  return seenItems[feedUrl].some((item) => item.link === link);
}

function getContentSnippet(
  html: string | undefined,
  maxLength: number = 200
): string {
  if (!html) return 'Không có mô tả';

  const text = html.replace(/<[^>]*>/g, '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '...';
}

// Validate RSS feed
export async function validateRSSFeed(
  feedUrl: string
): Promise<{ valid: boolean; error?: string; title?: string }> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return { valid: true, title: feed.title };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

// Send to Discord channel
async function sendToDiscord(
  client: Client,
  channelId: string,
  data: { feedTitle: string; feedUrl: string; item: RSSItem }
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.error('❌ Không tìm thấy kênh');
      return;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement &&
      channel.type !== ChannelType.DM
    ) {
      console.error('❌ Kênh không phải text channel');
      return;
    }

    const textChannel = channel as TextChannel;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(data.item.title)
      .setURL(data.item.link)
      .setDescription(data.item.contentSnippet || 'Không có mô tả')
      .setFooter({ text: `Nguồn: ${data.feedTitle}` })
      .setTimestamp();

    await textChannel.send({ embeds: [embed] });
    console.log(`✓ Đã gửi bài "${data.item.title}" đến Discord`);
  } catch (error) {
    console.error(
      '❌ Lỗi khi gửi tin nhắn đến Discord:',
      (error as Error).message
    );
  }
}

// **MỚI**: Fetch và gửi bài đầu tiên khi add feed
export async function fetchAndSendInitialPosts(
  client: Client,
  feedUrl: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const config = loadConfig();

    if (!config.feedChannelId) {
      return {
        success: false,
        count: 0,
        error: 'Chưa thiết lập kênh RSS. Dùng /setfeedchannel trước.',
      };
    }

    console.log(`📡 Đang fetch bài từ feed mới: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);

    // Lấy 3 bài mới nhất
    const itemsToSend = feed.items.slice(0, INITIAL_ITEMS_TO_SEND);
    let sentCount = 0;

    for (const item of itemsToSend) {
      const link = item.link;
      const title = item.title;

      if (!link || !title) continue;

      const contentSnippet = getContentSnippet(
        item.contentSnippet || item.description
      );

      const newItem: RSSItem = {
        title,
        link,
        contentSnippet,
      };

      // Gửi đến Discord
      await sendToDiscord(client, config.feedChannelId, {
        feedTitle: feed.title || 'RSS Feed',
        feedUrl: feedUrl,
        item: newItem,
      });

      // Thêm vào cache để không gửi lại
      addToCache(feedUrl, newItem);

      sentCount++;

      // Delay nhỏ giữa các message để tránh rate limit
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Lưu cache
    saveCache();

    return {
      success: true,
      count: sentCount,
    };
  } catch (error) {
    console.error('❌ Lỗi khi fetch initial posts:', (error as Error).message);
    return {
      success: false,
      count: 0,
      error: (error as Error).message,
    };
  }
}

// Check single RSS feed
async function checkRSSFeed(
  feedUrl: string,
  client: Client,
  config: BotConfig
): Promise<number> {
  try {
    const feed = await parser.parseURL(feedUrl);
    let newItemsCount = 0;

    for (const item of feed.items) {
      const link = item.link;
      const title = item.title;

      if (!link || !title) continue;

      if (!isItemSeen(feedUrl, link)) {
        newItemsCount++;

        const contentSnippet = getContentSnippet(
          item.contentSnippet || item.description
        );

        const newItem: RSSItem = {
          title,
          link,
          contentSnippet,
        };

        addToCache(feedUrl, newItem);

        if (config.feedChannelId) {
          await sendToDiscord(client, config.feedChannelId, {
            feedTitle: feed.title || 'RSS Feed',
            feedUrl: feedUrl,
            item: newItem,
          });
        }

        console.log(`🆕 Bài mới từ ${feed.title}: ${title}`);
      }
    }

    return newItemsCount;
  } catch (error) {
    console.error(
      `❌ Lỗi khi parse RSS [${feedUrl}]:`,
      (error as Error).message
    );
    return 0;
  }
}

// Check all feeds
async function checkAllFeeds(client: Client, config: BotConfig): Promise<void> {
  console.log(
    `\n⏰ [${new Date().toLocaleString('vi-VN')}] Kiểm tra ${
      config.rssFeeds.length
    } nguồn RSS`
  );

  if (config.rssFeeds.length === 0) {
    console.log('⚠️  Chưa có nguồn RSS nào. Dùng /addRSSFeeds để thêm.');
    return;
  }

  let totalNewItems = 0;

  for (const feedUrl of config.rssFeeds) {
    const newItems = await checkRSSFeed(feedUrl, client, config);
    totalNewItems += newItems;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  saveCache();
  console.log(`✅ Hoàn thành. Tìm thấy ${totalNewItems} bài mới.`);
}

// Start RSS watcher
export function startRSSWatcher(client: Client): void {
  loadCache();
  const config = loadConfig();

  console.log('🚀 RSS Watcher đã khởi động');
  console.log(`📋 Số nguồn RSS: ${config.rssFeeds.length}`);
  console.log(`💾 Lưu tối đa ${MAX_ITEMS_PER_FEED} bài/nguồn`);
  console.log(`⏱️  Kiểm tra mỗi ${config.checkIntervalMinutes} phút`);

  // Check immediately
  checkAllFeeds(client, config);

  // Schedule cron job
  scheduleRSSCheck(client, config.checkIntervalMinutes);
}

// Schedule RSS check
function scheduleRSSCheck(client: Client, intervalMinutes: number): void {
  if (cronJob) {
    cronJob.stop();
  }

  const config = loadConfig();

  cronJob = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
    await checkAllFeeds(client, config);
  });

  console.log(`⏱️  Đã thiết lập kiểm tra mỗi ${intervalMinutes} phút`);
}

// Update interval
export function updateInterval(client: Client, newInterval: number): void {
  scheduleRSSCheck(client, newInterval);
}
