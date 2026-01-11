import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { loadConfig, saveConfig, updateInterval } from '../utils/rssWatcher';

export const data = new SlashCommandBuilder()
  .setName('changeinterval')
  .setDescription('Thay đổi khoảng thời gian kiểm tra RSS feed')
  .addIntegerOption((option) =>
    option
      .setName('minutes')
      .setDescription('Số phút giữa mỗi lần kiểm tra (tối thiểu 5 phút)')
      .setRequired(true)
      .setMinValue(5)
      .setMaxValue(1440)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const minutes = interaction.options.getInteger('minutes', true);

  const config = loadConfig();
  config.checkIntervalMinutes = minutes;
  saveConfig(config);

  // Update cron job
  updateInterval(interaction.client, minutes);

  return interaction.reply({
    content: `✅ Đã thay đổi interval kiểm tra RSS feed: **${minutes} phút**`,
    ephemeral: true,
  });
}
