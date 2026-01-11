import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { loadConfig, saveConfig } from '../utils/rssWatcher';

export const data = new SlashCommandBuilder()
  .setName('setfeedchannel')
  .setDescription('Thiết lập kênh để nhận RSS feed updates')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Kênh để gửi RSS updates')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);

  if (!channel) {
    return interaction.reply({
      content: '❌ Không tìm thấy kênh!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const config = loadConfig();
  config.feedChannelId = channel.id;
  saveConfig(config);

  return interaction.reply({
    content: `✅ Đã thiết lập kênh RSS feed: <#${channel.id}>`,
    flags: MessageFlags.Ephemeral,
  });
}
