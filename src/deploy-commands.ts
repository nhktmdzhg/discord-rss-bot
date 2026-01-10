import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`✓ Loaded command: ${command.data.name}`);
  } else {
    console.warn(`⚠️  Command at ${filePath} is missing "data" or "execute"`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`\n🔄 Bắt đầu đăng ký ${commands.length} slash commands...`);

    const data: any = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID!,
        process.env.GUILD_ID!
      ),
      { body: commands }
    );

    console.log(`✅ Đã đăng ký ${data.length} slash commands thành công!`);
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
})();
