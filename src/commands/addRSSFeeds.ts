import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import {
  loadConfig,
  saveConfig,
  validateRSSFeed,
  fetchAndSendInitialPosts,
} from '../utils/rssWatcher';

export const data = new SlashCommandBuilder()
  .setName('addrssfeeds')
  .setDescription('Thêm nguồn RSS feed mới')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option.setName('url').setDescription('URL của RSS feed').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const feedUrl = interaction.options.getString('url', true);

  // Validate RSS feed
  const validation = await validateRSSFeed(feedUrl);

  if (!validation.valid) {
    return interaction.editReply({
      content: `❌ RSS feed không hợp lệ!\nLỗi: ${validation.error}`,
    });
  }

  const config = loadConfig();

  // Check if feed already exists
  if (config.rssFeeds.includes(feedUrl)) {
    return interaction.editReply({
      content: '⚠️ RSS feed này đã tồn tại trong danh sách!',
    });
  }

  // Add feed
  config.rssFeeds.push(feedUrl);
  saveConfig(config);

  // Gửi message trước
  await interaction.editReply({
    content: `✅ Đã thêm RSS feed: **${validation.title}**\n🔗 ${feedUrl}\n📋 Tổng số feeds: ${config.rssFeeds.length}\n\n⏳ Đang lấy bài mới nhất...`,
  });

  // Fetch và gửi bài đầu tiên
  const result = await fetchAndSendInitialPosts(interaction.client, feedUrl);

  if (result.success) {
    await interaction.followUp({
      content: `🎉 Đã gửi ${result.count} bài mới nhất vào kênh RSS!\n💡 Từ giờ bot sẽ tự động gửi bài mới từ nguồn này.`,
      ephemeral: true,
    });
  } else {
    await interaction.followUp({
      content: `⚠️ Feed đã được thêm nhưng không thể gửi bài đầu tiên.\nLý do: ${
        result.error || 'Unknown'
      }`,
      ephemeral: true,
    });
  }
}
