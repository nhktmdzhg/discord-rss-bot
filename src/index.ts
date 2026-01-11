import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { startRSSWatcher } from './utils/rssWatcher';
import express from 'express';
import https from 'https';

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

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed / 1024 / 1024,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('Discord RSS Bot is running! 🤖');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

function keepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  
  if (!url) {
    console.log('⚠️  RENDER_EXTERNAL_URL not set, skipping self-ping');
    return;
  }
  
  setInterval(() => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Keep-alive ping successful (${new Date().toLocaleTimeString('vi-VN')})`);
      } else {
        console.log(`⚠️  Keep-alive ping returned ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.error('❌ Keep-alive ping failed:', err.message);
    });
  }, 14 * 60 * 1000);
}

// Ready event
client.once(Events.ClientReady, (c) => {
  console.log(`\n🤖 Discord Bot đã online: ${c.user.tag}`);
  console.log('━'.repeat(50));

  // Start RSS watcher
  startRSSWatcher(client);

  keepAlive();
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
