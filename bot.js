import { Client, GatewayIntentBits, Collection, EmbedBuilder, ActivityType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config.json properly
let token;
try {
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    token = config.token;
    if (!token) throw new Error('Token is missing in config.json!');
} catch (error) {
    console.error('Error loading config.json:', error);
    process.exit(1);
}

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to read message content
    ]
});

// Command collection
client.commands = new Collection();

// Load command files dynamically from the "commands" folder
const commandsDirectory = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsDirectory)) {
    console.error('❌ Commands folder does not exist:', commandsDirectory);
    process.exit(1);
}

// Read command files
const commandFiles = fs.readdirSync(commandsDirectory).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = await import(`file://${path.join(commandsDirectory, file)}`);
    if (!command.data) {
        console.error(`⚠️ Command file ${file} is missing the 'data' property.`);
        continue;
    }
    client.commands.set(command.data.name, command);
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Event when bot logs in
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} has logged in!`);
    
    // Set the bot's presence with status and detailed activity
    client.user.setPresence({
        status: 'online', // Can be 'online', 'idle', 'dnd', or 'invisible'
        activities: [{
            name: 'Minecraft & Roblox Servers',
            type: ActivityType.Playing, // Using the ActivityType enum
            state: 'Type /help for commands',
            details: 'Find info on your favorite games'
        }]
    });
    
    // You can periodically update the status if desired
    setInterval(() => {
        const activities = [
            {
                name: 'Minecraft & Roblox Servers',
                type: ActivityType.Playing
            },
            {
                name: 'for server stats',
                type: ActivityType.Watching
            },
            {
                name: '/help for commands',
                type: ActivityType.Listening
            }
        ];
        
        const activity = activities[Math.floor(Math.random() * activities.length)];
        
        client.user.setActivity(activity.name, { type: activity.type });
    }, 3600000); // Update every hour (3600000 ms)
});

// Start the bot
console.log('🔄 Logging in...');
client.login(token).catch(error => {
    console.error('❌ Failed to log in! Check your token:', error);
});