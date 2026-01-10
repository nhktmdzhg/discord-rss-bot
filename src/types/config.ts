export interface RSSItem {
  title: string;
  link: string;
  contentSnippet?: string;
}

export interface CacheData {
  [feedUrl: string]: RSSItem[];
}

export interface BotConfig {
  feedChannelId: string | null;
  rssFeeds: string[];
  checkIntervalMinutes: number;
}
