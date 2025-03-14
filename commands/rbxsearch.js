import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the saved games file
const savedGamesPath = path.join(__dirname, 'savedGames.json');

// Initialize an empty object for saved games
let savedGames = {};

// Load saved games from file
function loadSavedGames() {
    if (fs.existsSync(savedGamesPath)) {
        const data = fs.readFileSync(savedGamesPath, 'utf-8');
        try {
            savedGames = data ? JSON.parse(data) : {}; // If the file is empty, initialize as an empty object
        } catch (error) {
            console.error('Error parsing saved games:', error);
            savedGames = {}; // Initialize as empty object if parsing fails
        }
    } else {
        savedGames = {}; // Initialize as empty if the file doesn't exist
    }
}

// Save a game ID to the file
function saveGameId(gameId, gameName) {
    loadSavedGames(); // Load the saved games before saving a new one

    savedGames[gameName] = gameId;
    
    // Ensure the file exists before writing to it
    if (!fs.existsSync(savedGamesPath)) {
        fs.writeFileSync(savedGamesPath, '{}'); // Create file if it doesn't exist
    }

    fs.writeFileSync(savedGamesPath, JSON.stringify(savedGames, null, 2));
}

// Function to convert place ID to universe ID
async function getUniverseId(placeId) {
    try {
        const response = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
        const data = await response.json();
        
        if (data && data.universeId) {
            return data.universeId;
        }
        
        console.error('Unable to get universe ID for place ID:', placeId);
        return null;
    } catch (error) {
        console.error('Error converting place ID to universe ID:', error);
        return null;
    }
}

// Function to fetch Roblox game icon
async function getGameIcon(universeId) {
    try {
        // Attempt to get the game icon from Roblox API
        const response = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png&isCircular=false`);
        const data = await response.json();
        
        if (data && data.data && data.data.length > 0 && data.data[0].imageUrl) {
            return data.data[0].imageUrl;
        }
        
        // Fallback to a default icon if we couldn't get the game's icon
        return null;
    } catch (error) {
        console.error('Error fetching game icon:', error);
        return null;
    }
}

// Function to fetch Roblox game data
async function getRobloxGameData(gameId) {
    if (!gameId) {
        console.error('Invalid game ID:', gameId);
        return null;
    }

    try {
        // First try to convert place ID to universe ID if needed
        let universeId = gameId;
        try {
            // This check isn't foolproof but can help identify place IDs vs universe IDs
            universeId = await getUniverseId(gameId);
            if (!universeId) {
                // If conversion fails, try using the original ID
                universeId = gameId;
            }
            console.log(`Using universe ID: ${universeId} for provided ID: ${gameId}`);
        } catch (error) {
            console.warn('Error converting ID, will try with original:', error);
        }

        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (data && data.errors) {
            console.error('API returned errors:', data.errors);
            return null;
        }
        
        if (!data || !data.data || data.data.length === 0) {
            console.error('Invalid game data received:', data);
            
            // Try an alternative API for place IDs
            try {
                console.log('Trying alternative API...');
                const placeResponse = await fetch(`https://www.roblox.com/places/api-get-details?assetId=${gameId}`);
                const placeData = await placeResponse.json();
                
                if (placeData && placeData.Name) {
                    // Try to get the game icon (though this may not work for place IDs)
                    const gameIcon = await getGameIcon(gameId);
                    
                    return {
                        name: placeData.Name,
                        description: placeData.Description || 'No description available.',
                        players: placeData.OnlineCount || 0,
                        visits: placeData.VisitedCount || 0,
                        thumbnail: `https://tr.rbxcdn.com/place-thumbnail/image?id=${gameId}&width=768&height=432&format=png`,
                        gameId: gameId,
                        icon: gameIcon
                    };
                }
            } catch (altError) {
                console.error('Alternative API also failed:', altError);
            }
            
            return null;
        }

        const gameInfo = data.data[0];
        
        // Get the game icon
        const gameIcon = await getGameIcon(universeId);

        return {
            name: gameInfo.name,
            description: gameInfo.description || 'No description available.',
            players: gameInfo.playing || 0,
            visits: gameInfo.visits || 0,
            thumbnail: `https://tr.rbxcdn.com/place-thumbnail/image?id=${gameId}&width=768&height=432&format=png`,
            gameId: gameId,
            icon: gameIcon
        };
    } catch (error) {
        console.error('Error fetching Roblox game data:', error);
        return null;
    }
}

// Function to build the embed
function buildEmbed(gameData) {
    const embed = new EmbedBuilder()
        .setTitle(`Roblox Game: ${gameData.name}`)
        .setDescription(gameData.description)
        .setImage(gameData.thumbnail) // Use setImage for the game thumbnail (larger)
        .addFields(
            { name: '🕹️ Players Online', value: `${gameData.players}`, inline: true },
            { name: '👀 Total Visits', value: `${gameData.visits}`, inline: true },
            { name: '🆔 Game ID', value: gameData.gameId, inline: true }
        )
        .setColor('#FF0000') // Roblox red
        .setFooter({ text: 'Powered by Roblox API/Undefined Search' })
        .setTimestamp();
        
    // Add the game icon as thumbnail if available
    if (gameData.icon) {
        embed.setThumbnail(gameData.icon);
    }
    
    return embed;
}

// Function to resolve game ID (either from saved games or from user input)
async function resolveGameId(gameIdOrName) {
    loadSavedGames(); // Make sure saved games are loaded
    
    let gameId = savedGames[gameIdOrName] || gameIdOrName; // Check if it's a saved name, otherwise use the ID directly

    if (!gameId) {
        console.error('No valid game ID found for:', gameIdOrName);
        return null;
    }

    const gameData = await getRobloxGameData(gameId);
    if (!gameData) {
        return null;
    }

    return gameData;
}

// Define the command structure
export const data = new SlashCommandBuilder()
    .setName('rbxsearch')
    .setDescription('Search for a Roblox game')
    .addStringOption(option =>
        option.setName('gameid')
            .setDescription('The Roblox game ID or saved name to search')
            .setRequired(true))
    .addSubcommand(subcommand =>
        subcommand.setName('save')
            .setDescription('Save a game ID to a name')
            .addStringOption(option =>
                option.setName('gameid')
                    .setDescription('The Roblox game ID')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('gamename')
                    .setDescription('The name to save the game under')
                    .setRequired(true)));

// Handle command execution
export async function execute(interaction) {
    try {
        // Check if this is using a subcommand or not
        let isUsingSubcommand = false;
        let subcommand = null;
        
        try {
            subcommand = interaction.options.getSubcommand(false);
            if (subcommand) {
                isUsingSubcommand = true;
            }
        } catch (error) {
            // If error or no subcommand, we'll use the gameid option directly
            isUsingSubcommand = false;
        }

        // Handle save subcommand
        if (isUsingSubcommand && subcommand === 'save') {
            const gameId = interaction.options.getString('gameid');
            const gameName = interaction.options.getString('gamename');
            
            if (!gameId || !gameName) {
                return interaction.reply('⚠️ Both game ID and game name are required.');
            }
            
            saveGameId(gameId, gameName);
            return interaction.reply(`Game ID ${gameId} has been saved under the name ${gameName}.`);
        }
        
        // Handle regular search (no subcommand)
        if (!isUsingSubcommand) {
            const gameInput = interaction.options.getString('gameid');
            console.log('Received game input:', gameInput); // Log the received game input

            if (!gameInput) {
                console.error('No game input provided.');
                return interaction.reply('⚠️ Please provide a Roblox game ID or saved game name. Example: `/rbxsearch gameid:123456`');
            }

            // Let the user know we're processing
            await interaction.deferReply();
            
            const gameData = await resolveGameId(gameInput);
            if (!gameData) {
                return interaction.editReply('⚠️ No valid game ID or game data found. Please make sure you\'re using a valid Roblox place ID or universe ID.');
            }

            const embed = buildEmbed(gameData);
            
            // Create refresh button
            const refreshButton = new ButtonBuilder()
                .setCustomId('refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary);
                
            const row = new ActionRowBuilder().addComponents(refreshButton);

            // Send the embed with the button
            const message = await interaction.editReply({ embeds: [embed], components: [row] });

            // Create interaction collector for the refresh button
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000, // 5 minutes
                filter: i => i.user.id === interaction.user.id,
            });

            collector.on('collect', async i => {
                if (i.customId === 'refresh') {
                    const updatedData = await resolveGameId(gameInput);
                    if (updatedData) {
                        const updatedEmbed = buildEmbed(updatedData);
                        // Update the original message
                        await i.update({ embeds: [updatedEmbed], components: [row] });
                    } else {
                        await i.followUp({ content: '⚠️ Error updating game status.', ephemeral: true });
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
        } else {
            // If a subcommand was provided but it wasn't 'save'
            return interaction.reply('⚠️ Unknown command. Use `/rbxsearch gameid:123456` to search for a game or `/rbxsearch save` to save a game ID.');
        }
    } catch (error) {
        console.error('Error executing command:', error);
        
        // Check if the interaction has been deferred
        if (interaction.deferred) {
            await interaction.editReply({ content: '⚠️ An error occurred while executing the command: ' + error.message });
        } else {
            await interaction.reply({ content: '⚠️ An error occurred while executing the command: ' + error.message, ephemeral: true });
        }
    }
}
