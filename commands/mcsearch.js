import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import fetch from 'node-fetch';

// Define the command structure (only one option: IP)
export const data = {
    name: 'mcsearch',
    description: 'Check Minecraft server status',
    options: [
        {
            name: 'ip',
            type: 3, // STRING type in Discord API
            description: 'The Minecraft server IP or domain',
            required: true,
        },
    ],
};

// Function to fetch Minecraft server data
async function getServerStatus(ip, port = 25565) {
    try {
        const response = await fetch(`https://api.mcsrvstat.us/2/${ip}:${port}`);
        const serverData = await response.json();

        if (!serverData.online) return null;

        return {
            ip,
            port,
            version: serverData.version || 'Unknown',
            playersOnline: serverData.players.online || 0,
            maxPlayers: serverData.players.max || 0,
            motd: serverData.motd?.clean?.join('\n') || 'No description available',
            // If the returned icon starts with "data:" (base64), fallback to a valid URL.
            favicon: (serverData.icon && !serverData.icon.startsWith('data:'))
                ? serverData.icon
                : `https://api.mcsrvstat.us/icon/${ip}`,
        };
    } catch (error) {
        console.error('Error fetching Minecraft server data:', error);
        return null;
    }
}

// Function to create the embed
async function buildEmbed(ip, port, serverData) {
    return new EmbedBuilder()
        .setTitle(`Minecraft Server: ${ip}`)
        .setThumbnail(serverData.favicon)
        .setDescription(serverData.motd)
        .setColor('#00FF00') // Minecraft green
        .addFields(
            { name: '🟢 Players Online', value: `${serverData.playersOnline}/${serverData.maxPlayers}`, inline: true },
            { name: '🌍 Version', value: serverData.version, inline: true }
        )
        .setFooter({ text: 'Powered by MCSrvStat/Undefined Search' })
        .setTimestamp();
}

// Handle command execution
export async function execute(interaction) {
    const ip = interaction.options.getString('ip');
    const port = 25565; // Always use port 25565 for Java servers

    const serverData = await getServerStatus(ip, port);
    if (!serverData) {
        return interaction.reply('⚠️ The server is offline or unreachable.');
    }

    const embed = await buildEmbed(ip, port, serverData);

    // Refresh button
    const refreshButton = new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(refreshButton);

    // Send the embed with the button
    await interaction.reply({ embeds: [embed], components: [row] });
    const message = await interaction.fetchReply();

    // Create interaction collector for the refresh button
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
        filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async i => {
        if (i.customId === 'refresh') {
            const updatedData = await getServerStatus(ip, port);
            if (updatedData) {
                const updatedEmbed = await buildEmbed(ip, port, updatedData);
                // Update the original message using i.update()
                await i.update({ embeds: [updatedEmbed], components: [row] });
            } else {
                await i.followUp({ content: '⚠️ Error updating server status.', ephemeral: true });
            }
        }
    });

    collector.on('end', async () => {
        const disabledButton = ButtonBuilder.from(refreshButton).setDisabled(true);
        const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
        try {
            await message.edit({ components: [disabledRow] });
        } catch (editError) {
            console.error('Error disabling button:', editError);
        }
    });
}
