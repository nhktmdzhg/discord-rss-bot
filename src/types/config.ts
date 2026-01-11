export interface RSSItem {
  title: string;
  link: string;
  contentSnippet?: string;
  pubDate?: string;
}

export interface CacheData {
  [feedUrl: string]: string;
}

export interface BotConfig {
  feedChannelId: string | null;
  rssFeeds: string[];
  checkIntervalMinutes: number;
}
