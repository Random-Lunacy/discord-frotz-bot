import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    SlashCommandBuilder,
    ComponentType,
} from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { sessions } from '../../sessions.js';
import { launchGame } from '../../launchGame.js';
import dateFormat from 'dateformat';
import {
    gameForChannel,
    listSaves,
    parseSaveName,
    preferChannel,
} from '../../saves.js';

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
            'Restore a save. In a thread it restores that thread\'s game; in a channel you pick the game.'
        )
        .addStringOption((option) =>
            option
                .setName('game')
                .setDescription(
                    'Game to restore (default: the game for this thread)'
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
 * @param {string} [channelId] - Prefer a save made in this channel or thread
 * @return {string|null} - Path to the most recent save file or null if none found
 */
async function findMostRecentSave(gameId, channelId) {
    const saves = listSaves(sharedData.gameFolder, gameId);
    return preferChannel(saves, channelId)[0]?.path ?? null;
}

/**
 * Get a list of games that have save files
 *
 * @return {Array} - Array of game objects that have saves
 */
async function getGamesWithSaves(channelId) {
    try {
        const gamesWithSaves = [];

        for (const game of sharedData.gameList.games) {
            const saveExists = await findMostRecentSave(game.id, channelId);
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
 * Start a game with the specified ID, in a new thread if the command was used in a text channel
 *
 * @param {string} gameId - The ID of the game to start
 * @param {Object} originalInteraction - The original command interaction, used for all updates
 * @param {string} [savePath] - The save about to be restored; its thread is reused if it still exists
 * @return {Object|null} - The running game, or null if it could not be started
 */
async function startGame(gameId, originalInteraction, savePath) {
    try {
        const gameObj = sharedData.gameList.games.find(
            (it) => it.id === gameId
        );

        if (!gameObj) {
            await originalInteraction.editReply({
                content: `Could not find game with ID "${gameId}".`,
                components: [],
            });
            return null;
        }

        const result = await launchGame(originalInteraction, gameObj, {
            reuse: true,
            threadId: savePath ? parseSaveName(savePath)?.channelId : undefined,
        });
        if (result.error) {
            await originalInteraction.editReply({
                content: result.error,
                components: [],
            });
            return null;
        }

        await originalInteraction.editReply({
            content: `Starting ${gameObj.name} in <#${result.session.channel.id}>...`,
            components: [],
        });

        return result.session;
    } catch (error) {
        Logger.log({
            level: 'error',
            message: `Error starting game: ${error.message}`,
            stack: error.stack,
        });

        try {
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
        return null;
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
    let specifiedGameId = interaction.options.getString('game');
    const session = sessions.get(interaction.channel.id);

    // In a thread with no game running, restore the game the thread was for rather than asking
    if (!session && !specifiedGameId && interaction.channel.isThread?.()) {
        specifiedGameId =
            gameForChannel(
                sharedData.gameFolder,
                sharedData.gameList.games,
                interaction.channel
            )?.id ?? null;
    }
    if (session && specifiedGameId) {
        await interaction.editReply({
            content:
                'A game is already running here, so the game parameter is ignored. To play a different game, use `/restore` in another channel.',
            components: [],
        });

        // Short delay before showing the save selection
        setTimeout(async () => {
            await handleRestoreForActiveGame(interaction, session);
        }, 2000);
        return;
    }

    if (session) {
        await handleRestoreForActiveGame(interaction, session);
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
        const mostRecentSave = await findMostRecentSave(
            specifiedGameId,
            interaction.channel.id
        );
        if (!mostRecentSave) {
            await interaction.editReply({
                content: `No saved games found for "${gameObj.name}". Use /start to start a new game.`,
                components: [],
            });
            return;
        }

        const started = await startGame(
            specifiedGameId,
            interaction,
            mostRecentSave
        );
        if (started) {
            await restoreSaveFile(mostRecentSave, interaction, started);
        }
        return;
    }

    // No game specified, show list of games that have saves
    const gamesWithSaves = await getGamesWithSaves(interaction.channel.id);

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
            const mostRecentSave = await findMostRecentSave(
                selection,
                interaction.channel.id
            );
            const started = await startGame(selection, interaction, mostRecentSave);
            if (started) {
                // Game started, now restore the most recent save
                if (mostRecentSave) {
                    await restoreSaveFile(mostRecentSave, interaction, started);
                } else {
                    await interaction.editReply({
                        content: `Started ${started.game.name}, but couldn't find a save file to restore.`,
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
 * @param {Object} session - The game running in this channel
 */
async function handleRestoreForActiveGame(interaction, session) {
    const displayName = session.game.name;

    // A select menu holds 25 options and one is Cancel
    const saves = preferChannel(
        listSaves(sharedData.gameFolder, session.game.id),
        interaction.channel.id
    ).slice(0, 24);
    if (saves.length === 0) {
        await interaction.editReply({
            content: 'No saved games found for ' + displayName + '.',
            components: [],
        });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('save-select')
        .setPlaceholder('Choose a save file');

    saves.forEach((save) => {
        const saveTime = new Date(save.time * 1000);
        const user =
            sharedData.client.users.cache.get(save.userId)?.globalName ??
            save.userId;
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    (save.label ? save.label + ' - ' : '') +
                        user +
                        ': ' +
                        dateFormat(saveTime, 'default')
                )
                .setDescription(
                    'Created on ' +
                        dateFormat(saveTime, 'dddd, mmmm dS, yyyy, h:MM:ss TT')
                )
                .setValue(save.path)
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
            let restoredTime = new Date(parseSaveName(savePath).time * 1000);

            session.touch();
            if (!(await session.client.restoreGame(savePath))) {
                await interaction.editReply({
                    content: 'The game is not ready to restore a save right now.',
                    components: [],
                });
                return;
            }

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
 * Restore a specific save file into a game that was just started
 *
 * @param {string} savePath - Path to the save file
 * @param {Object} interaction - The Discord interaction object
 * @param {Object} session - The running game to restore into
 */
async function restoreSaveFile(savePath, interaction, session) {
    try {
        let restoredTime = new Date(parseSaveName(savePath).time * 1000);

        // The game has to reach its first prompt before it can restore
        if (!(await session.client.whenReady())) {
            throw new Error('the game did not become ready');
        }

        session.touch();
        if (!(await session.client.restoreGame(savePath))) {
            throw new Error('the game did not become ready');
        }

        // Always use editReply on the original interaction
        await interaction.editReply({
            content: `Restoring ${session.game.name} with save from ${dateFormat(
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
