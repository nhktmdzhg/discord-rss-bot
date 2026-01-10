import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { startRSSWatcher } from './utils/rssWatcher';

config();

// Extend Client type
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, any>;
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✓ Loaded command: ${command.data.name}`);
  }
}

// Ready event
client.once(Events.ClientReady, (c) => {
  console.log(`\n🤖 Discord Bot đã online: ${c.user.tag}`);
  console.log('━'.repeat(50));

  // Start RSS watcher
  startRSSWatcher(client);
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Command không tồn tại: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('❌ Lỗi khi thực thi command:', error);

    const errorMessage = {
      content: '❌ Có lỗi xảy ra khi thực thi command!',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
