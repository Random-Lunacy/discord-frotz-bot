import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    SlashCommandBuilder,
    ComponentType,
} from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { glob } from 'glob';
import dateFormat from 'dateformat';
import path from 'path';

import { Logger } from '../../logger.js';

/**
 * Create a new slash command builder for restoring a saved game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('restore')
        .setDescription(
            'Restore a saved game. If no game is running, you can select which game to start.'
        )
        .addStringOption((option) =>
            option
                .setName('game')
                .setDescription(
                    'Specific game to restore a save for (optional)'
                )
                .setRequired(false)
        );

    // Add game choices dynamically if possible
    if (sharedData.gameList?.games) {
        for (const game of sharedData.gameList.games) {
            command.options[0].addChoices({
                name: game.name,
                value: game.id,
            });
        }
    }

    return command.toJSON();
};

/**
 * Find the most recent save file for a given game ID
 *
 * @param {string} gameId - The ID of the game to find saves for
 * @return {string|null} - Path to the most recent save file or null if none found
 */
async function findMostRecentSave(gameId) {
    try {
        const qzlFiles = await glob(
            sharedData.gameFolder + '/' + gameId + '-*.qzl',
            { nodir: true }
        );

        if (qzlFiles.length === 0) {
            return null;
        }

        // Sort files by timestamp (which is the second part of the filename)
        qzlFiles.sort((a, b) => {
            const timeA = parseInt(a.split('-')[1]);
            const timeB = parseInt(b.split('-')[1]);
            return timeB - timeA; // Sort descending (newest first)
        });

        return qzlFiles[0]; // Return the most recent save
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error finding most recent save: ${error.message}`,
            stack: error.stack,
        });
        return null;
    }
}

/**
 * Get a list of games that have save files
 *
 * @return {Array} - Array of game objects that have saves
 */
async function getGamesWithSaves() {
    try {
        const gamesWithSaves = [];

        for (const game of sharedData.gameList.games) {
            const saveExists = await findMostRecentSave(game.id);
            if (saveExists) {
                gamesWithSaves.push(game);
            }
        }

        return gamesWithSaves;
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error getting games with saves: ${error.message}`,
            stack: error.stack,
        });
        return [];
    }
}

/**
 * Start a game with the specified ID
 *
 * @param {string} gameId - The ID of the game to start
 * @param {Object} interaction - The Discord interaction object
 * @param {Object} originalInteraction - The original command interaction for fallback
 * @return {boolean} - Whether the game started successfully
 */
async function startGame(gameId, interaction, originalInteraction) {
    try {
        const gameObj = sharedData.gameList.games.find(
            (it) => it.id === gameId
        );

        if (!gameObj) {
            // Use the original interaction since the component interaction is already handled
            await originalInteraction.editReply({
                content: `Could not find game with ID "${gameId}".`,
                components: [],
            });
            return false;
        }

        if (sharedData.channel === null) {
            sharedData.channel = originalInteraction.channel;
        }

        // Use the original interaction for all updates
        await originalInteraction.editReply({
            content: `Starting ${gameObj.name} in <#${sharedData.channel.id}>...`,
            components: [],
        });

        if (!sharedData.frotzClient.startGame(gameObj.file)) {
            const errorMessage = sharedData.frotzClient.lastError.message;
            await originalInteraction.editReply({
                content: errorMessage,
                components: [],
            });
            return false;
        }

        sharedData.gameId = gameId;
        sharedData.gameActive = true;
        sharedData.listenToGame = true;

        return true;
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error starting game: ${error.message}`,
            stack: error.stack,
        });

        try {
            // Always use the original interaction for responses
            await originalInteraction.editReply({
                content: `An error occurred while starting the game: ${error.message}`,
                components: [],
            });
        } catch (responseError) {
            Logger.log({
                level: 'error',
                message: `Error responding to interaction: ${responseError.message}`,
                stack: responseError.stack,
            });
        }
        return false;
    }
}

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    await interaction.deferReply();

    // If game ID is specified but a game is already running, provide helpful feedback
    const specifiedGameId = interaction.options.getString('game');
    if (sharedData.gameActive && specifiedGameId) {
        await interaction.editReply({
            content:
                'A game is already running. The game parameter is ignored. Use `/quit` first if you want to switch games.',
            components: [],
        });

        // Short delay before showing the save selection
        setTimeout(async () => {
            await handleRestoreForActiveGame(interaction);
        }, 2000);
        return;
    }

    if (sharedData.gameActive) {
        await handleRestoreForActiveGame(interaction);
        return;
    }

    // No game is running, so we need to offer to start one
    if (specifiedGameId) {
        // Find the game name from the ID first
        const gameObj = sharedData.gameList.games.find(
            (it) => it.id === specifiedGameId
        );
        if (!gameObj) {
            await interaction.editReply({
                content: `Could not find game with ID "${specifiedGameId}".`,
                components: [],
            });
            return;
        }

        // Game ID specified, check if it has saves
        const mostRecentSave = await findMostRecentSave(specifiedGameId);
        if (!mostRecentSave) {
            await interaction.editReply({
                content: `No saved games found for "${gameObj.name}". Use /start to start a new game.`,
                components: [],
            });
            return;
        }

        // Start the specified game - pass the interaction as both parameters
        const success = await startGame(
            specifiedGameId,
            interaction,
            interaction
        );
        if (success) {
            // Game started, now restore the save
            // Add a small delay to ensure the game is fully started
            setTimeout(async () => {
                await restoreSaveFile(mostRecentSave, interaction);
            }, 1500);
        }
        return;
    }

    // No game specified, show list of games that have saves
    const gamesWithSaves = await getGamesWithSaves();

    if (gamesWithSaves.length === 0) {
        await interaction.editReply({
            content:
                'No saved games found for any game. Use `/start` to start a new game.',
            components: [],
        });
        return;
    }

    // Create select menu for games with saves
    const select = new StringSelectMenuBuilder()
        .setCustomId('game-select')
        .setPlaceholder('Select a game to restore');

    gamesWithSaves.forEach((game) => {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(game.name)
                .setDescription(
                    `Start and restore the most recent save for ${game.name}`
                )
                .setValue(game.id)
        );
    });

    select.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Cancel')
            .setDescription('Cancel the restore operation')
            .setValue('cancel')
    );

    const row = new ActionRowBuilder().addComponents(select);

    const response = await interaction.editReply({
        content: 'Select a game to start and restore its most recent save:',
        components: [row],
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
    });

    collector.on('collect', async (i) => {
        try {
            // First, acknowledge the interaction
            await i.deferUpdate();

            const selection = i.values[0];
            if (selection === 'cancel') {
                await interaction.editReply({
                    content: 'Restore operation cancelled.',
                    components: [],
                });
                return;
            }

            // Start the selected game using the original interaction for updates
            const success = await startGame(selection, i, interaction);
            if (success) {
                // Game started, now find and restore the most recent save
                const mostRecentSave = await findMostRecentSave(selection);
                if (mostRecentSave) {
                    // Add a small delay to ensure the game is fully started
                    setTimeout(async () => {
                        try {
                            await restoreSaveFile(mostRecentSave, interaction);
                        } catch (restoreError) {
                            Logger.log({
                                level: 'error',
                                message: `Error in delayed restore: ${restoreError.message}`,
                                stack: restoreError.stack,
                            });
                            await interaction.editReply({
                                content: `Started the game but encountered an error restoring the save: ${restoreError.message}`,
                                components: [],
                            });
                        }
                    }, 1500);
                } else {
                    await interaction.editReply({
                        content: `Started ${
                            sharedData.gameList.games.find(
                                (game) => game.id === selection
                            ).name
                        }, but couldn't find a save file to restore.`,
                        components: [],
                    });
                }
            }
        } catch (error) {
            Logger.log({
                level: 'error',
                message: `Error in collector handler: ${error.message}`,
                stack: error.stack,
            });
            try {
                await interaction.editReply({
                    content: `An error occurred while processing your selection: ${error.message}`,
                    components: [],
                });
            } catch (responseError) {
                Logger.log({
                    level: 'error',
                    message: `Error responding to interaction: ${responseError.message}`,
                    stack: responseError.stack,
                });
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            await interaction.editReply({
                content:
                    'Selection timed out after 1 minute. Please try again.',
                components: [],
            });
        }
    });
}

/**
 * Handle restore for an active game
 *
 * @param {Object} interaction - The Discord interaction object
 */
async function handleRestoreForActiveGame(interaction) {
    const displayName = sharedData.gameList.games.find(
        (it) => it.id === sharedData.gameId
    ).name;

    const qzlFiles = await glob(
        sharedData.gameFolder + '/' + sharedData.gameId + '-*.qzl',
        { nodir: true }
    );
    if (qzlFiles.length === 0) {
        await interaction.editReply({
            content: 'No saved games found for ' + displayName + '.',
            components: [],
        });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('save-select')
        .setPlaceholder('Choose a save file');

    qzlFiles.forEach((file) => {
        let fileFields = file.substring(0, file.length - 4).split('-');
        let saveTime = new Date(parseInt(fileFields[1] * 1000));
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    sharedData.client.users.cache.get(fileFields[2])
                        ?.globalName +
                        ': ' +
                        dateFormat(saveTime, 'default')
                )
                .setDescription(
                    'Created on ' +
                        dateFormat(saveTime, 'dddd, mmmm dS, yyyy, h:MM:ss TT')
                )
                .setValue(file)
        );
    });

    select.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel('Cancel')
            .setDescription('Cancel the restore')
            .setValue('cancel')
    );

    const row = new ActionRowBuilder().addComponents(select);

    const response = await interaction.editReply({
        content: 'Choose the save you want to restore:',
        components: [row],
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
    });

    collector.on('collect', async (i) => {
        try {
            // Acknowledge the component interaction first
            await i.deferUpdate();

            const selection = i.values[0];
            if (selection === 'cancel') {
                await interaction.editReply({
                    content: 'Restore cancelled.',
                    components: [],
                });
                return;
            }

            // Use the original interaction for response updates
            let savePath = selection;
            let filename = path.basename(savePath);
            let restoredFileFields = filename
                .substring(0, filename.length - 4)
                .split('-');
            let restoredTime = new Date(parseInt(restoredFileFields[1] * 1000));

            sharedData.frotzClient.restoreGame(savePath);

            await interaction.editReply({
                content: `Restoring ${displayName} with save from ${dateFormat(
                    restoredTime,
                    'default'
                )}.`,
                components: [],
            });
        } catch (error) {
            Logger.log({
                level: 'error',
                message: `Error in save selection handler: ${error.message}`,
                stack: error.stack,
            });

            try {
                await interaction.editReply({
                    content: `An error occurred while restoring the save: ${error.message}`,
                    components: [],
                });
            } catch (responseError) {
                Logger.log({
                    level: 'error',
                    message: `Error responding to interaction: ${responseError.message}`,
                    stack: responseError.stack,
                });
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            try {
                await interaction.editReply({
                    content:
                        'Selection timed out after 1 minute. Please try again.',
                    components: [],
                });
            } catch (error) {
                Logger.log({
                    level: 'error',
                    message: `Error updating timed out interaction: ${error.message}`,
                    stack: error.stack,
                });
            }
        }
    });
}

/**
 * Restore a specific save file
 *
 * @param {string} savePath - Path to the save file
 * @param {Object} interaction - The Discord interaction object
 */
async function restoreSaveFile(savePath, interaction) {
    try {
        let filename = path.basename(savePath);
        let restoredFileFields = filename
            .substring(0, filename.length - 4)
            .split('-');
        let restoredTime = new Date(parseInt(restoredFileFields[1] * 1000));

        const displayName = sharedData.gameList.games.find(
            (it) => it.id === sharedData.gameId
        ).name;

        sharedData.frotzClient.restoreGame(savePath);

        // Always use editReply on the original interaction
        await interaction.editReply({
            content: `Restoring ${displayName} with save from ${dateFormat(
                restoredTime,
                'default'
            )}.`,
            components: [],
        });
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error restoring save: ${error.message}`,
            stack: error.stack,
        });

        // Always use editReply on the original interaction
        await interaction.editReply({
            content: `An error occurred while restoring the save: ${error.message}`,
            components: [],
        });
    }
}

export { create, invoke };
