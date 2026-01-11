import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const feedUrl = interaction.options.getString('url', true);

  const validation = await validateRSSFeed(feedUrl);

  if (!validation.valid) {
    return interaction.editReply({
      content: `❌ RSS feed không hợp lệ!\nLỗi: ${validation.error}`,
    });
  }

  const config = loadConfig();

  if (config.rssFeeds.includes(feedUrl)) {
    return interaction.editReply({
      content: '⚠️ RSS feed này đã tồn tại trong danh sách!',
    });
  }

  config.rssFeeds.push(feedUrl);
  saveConfig(config);

  await interaction.editReply({
    content: `✅ Đã thêm RSS feed: **${validation.title}**\n🔗 ${feedUrl}\n📋 Tổng số feeds: ${config.rssFeeds.length}\n\n⏳ Đang lấy bài mới nhất...`,
  });

  const result = await fetchAndSendInitialPosts(interaction.client, feedUrl);

  if (result.success) {
    await interaction.followUp({
      content: `🎉 Đã gửi ${result.count} bài mới nhất vào kênh RSS!\n💡 Từ giờ bot sẽ tự động gửi bài mới từ nguồn này.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.followUp({
      content: `⚠️ Feed đã được thêm nhưng không thể gửi bài đầu tiên.\nLý do: ${
        result.error || 'Unknown'
      }`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
