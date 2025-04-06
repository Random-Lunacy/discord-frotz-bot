This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded

## Additional Info

# Directory Structure
```
.github/
  workflows/
    npm-test.yml
  dependabot.yml
events/
  commands/
    channel.js
    games.js
    pause.js
    quit.js
    restore.js
    save.js
    start.js
    status.js
  interactionCreate.js
  ready.js
games/
  games.json.template
  games.md
tests/
  events/
    commands/
      channel.test.js
      games.test.js
      pause.test.js
      status.test.js
  cleanAnsi.test.js
  frotzClient.test.js
.env.template
.gitignore
cleanAnsi.js
eslint.config.mjs
frotz-bot.js
frotzClient.js
LICENSE
logger.js
package.json
README.md
sharedData.js
vitest.config.js
```

# Files

## File: .github/workflows/npm-test.yml
````yaml
name: NodeJS Tests and Coverage

on:
    push:
        branches: ['main']
    pull_request:
        branches: ['main']

jobs:
    build:
        runs-on: ubuntu-latest

        strategy:
            matrix:
                node-version: [20.x, 22.x]

        steps:
            - uses: actions/checkout@v4

            - name: Use Node.js ${{ matrix.node-version }}
              uses: actions/setup-node@v4
              with:
                  node-version: ${{ matrix.node-version }}

            - name: Install dependencies
              run: npm install

            - name: Lint
              run: npm run-script lint

            - name: Test with coverage
              run: npm run coverage

            - name: Upload coverage reports
              uses: actions/upload-artifact@v4
              with:
                  name: coverage-report-${{ matrix.node-version }}
                  path: coverage/

            # Only add comments on PRs
            - name: Add coverage comment to PR
              if: github.event_name == 'pull_request'
              uses: romeovs/lcov-reporter-action@v0.3.1
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  lcov-file: ./coverage/lcov.info
````

## File: .github/dependabot.yml
````yaml
# To get started with Dependabot version updates, you'll need to specify which
# package ecosystems to update and where the package manifests are located.
# Please see the documentation for all configuration options:
# https://docs.github.com/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file

version: 2
updates:
  - package-ecosystem: 'npm' # See documentation for possible values
    directory: '/' # Location of package manifests
    schedule:
      interval: 'weekly'
  - package-ecosystem: 'github-actions' # See documentation for possible values
    directory: '/' # Location of package manifests
    schedule:
      interval: 'weekly'
````

## File: events/commands/channel.js
````javascript
import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new SlashCommandBuilder object to set the channel.
 *
 * @return {Object} The JSON representation of the command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Set the  channel where the game will be played.')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'Channel you want to use for playing the game (defaults to current channel).'
                )
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        );

    return command.toJSON();
};

/**
 * Invokes the function with the given interaction.
 */
const invoke = (interaction) => {
    const channel = interaction.options.getChannel('channel');
    if (channel != null) {
        sharedData.channel = channel;
    } else {
        sharedData.channel = interaction.channel;
    }

    interaction.reply({
        content: 'Game channel set to <#' + sharedData.channel.id + '>.',
        flags: MessageFlags.Ephemeral,
    });
};

export { create, invoke };
````

## File: events/commands/games.js
````javascript
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new slash command for listing available games.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('games')
        .setDescription('Lists available games');

    return command.toJSON();
};

/**
 * Generates a response to an interaction event.
 *
 * @param {object} interaction - The interaction event object.
 */
const invoke = (interaction) => {
    let embed = new EmbedBuilder()
        .setTitle('Available Games')
        .setDescription('Start a game with `/start [game]`. Only one game may be running at a time.')
        .setColor(0x0099ff);

    let x, current, names = '';

    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        names += current.name + '\n';
    }

    embed.addFields([
        {
            name: 'Name',
            value: names,
            inline: true
        },
    ]);

    interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
};

export { create, invoke };
````

## File: events/commands/pause.js
````javascript
import { SlashCommandBuilder, MessageFlags } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new slash command for pausing or unpausing the game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('pause')
        .setDescription(
            'Pause or unpause the game (toggles whether the bot will listen to messages).'
        );

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    if (!sharedData.gameActive) {
        interaction.reply({
            content: 'No game is currently running.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    let confirmButtonText = 'Pause Game';
    let confirmMessage =
        'Are you sure you want to pause the game? The game will stop listening to messages while paused.';
    let responseMessage = 'Game paused.';
    if (!sharedData.listenToGame) {
        confirmButtonText = 'Unpause Game';
        confirmMessage =
            'Are you sure you want to unpause the game? The game will resume listening to messages.';
        responseMessage = 'Game unpaused.';
    }

    let gameName = sharedData.gameList.games.filter(
        (it) => it.id === sharedData.gameId
    )[0].name;

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel(confirmButtonText)
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({
        content: confirmMessage,
        components: [row],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === 'confirm') {
            sharedData.listenToGame = !sharedData.listenToGame;

            await confirmation.update({
                content: responseMessage + gameName + '.',
                components: [],
            });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({
                content: 'Pause state toggle cancelled.',
                components: [],
            });
        }
    } catch (e) {
        await interaction.editReply({
            content:
                'Confirmation not received within 1 minute, cancelling toggle of pause state.',
            components: [],
        });
    }
}

export { create, invoke };
````

## File: events/commands/quit.js
````javascript
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new Slash Command for quitting the game.
 *
 * @return {Object} The JSON representation of the created command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('quit')
        .setDescription(
            'Quits the game. All progress since the game was last saved will be lost.'
        );

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    if (!sharedData.gameActive) {
        interaction.reply({
            content: 'No game is currently running.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    let gameName = sharedData.gameList.games.filter(
        (it) => it.id === sharedData.gameId
    )[0].name;

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Quit Game')
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({
        content:
            'Are you sure you want quit ' +
            gameName +
            '? All progress since last save will be lost.',
        components: [row],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === 'confirm') {
            sharedData.playingGame = false;
            sharedData.gameActive = false;
            sharedData.gameId = null;
            sharedData.frotzClient.stopGame();

            await confirmation.update({
                content: 'Quitting ' + gameName + '.',
                components: [],
            });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({
                content: 'Quit cancelled.',
                components: [],
            });
        }
    } catch (e) {
        await interaction.editReply({
            content:
                'Confirmation not received within 1 minute, cancelling quit.',
            components: [],
        });
    }
}

export { create, invoke };
````

## File: events/commands/restore.js
````javascript
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
````

## File: events/commands/save.js
````javascript
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';
import { sharedData } from '../../sharedData.js';
import { Logger } from '../../logger.js';

/**
 * Create a new slash command builder for saving the current game.
 *
 * @return {Object} The JSON representation of the slash command.
 */
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('save')
        .setDescription('Save the current game.');

    return command.toJSON();
};

/**
 * Asynchronously invokes the function with the given interaction.
 *
 * @param {Object} interaction - The interaction object.
 */
async function invoke(interaction) {
    if (!sharedData.gameActive) {
        interaction.reply({
            content: 'No game is currently running.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Save Game')
        .setStyle(ButtonStyle.Success);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({
        content: 'Are you sure you want save the game?',
        components: [row],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 60_000,
        });

        if (confirmation.customId === 'confirm') {
            let unixTime = Math.floor(Date.now() / 1000);
            let saveFile = `${sharedData.gameId}-${unixTime}-${interaction.user.id}.qzl`;
            let savePath = `${sharedData.gameFolder}/${saveFile}`;

            sharedData.frotzClient.saveGame(savePath);

            await confirmation.update({
                content: 'Game Saved.',
                components: [],
            });
        } else if (confirmation.customId === 'cancel') {
            await confirmation.update({
                content: 'Save cancelled.',
                components: [],
            });
        }
    } catch (e) {
        await interaction.editReply({
            content:
                'Confirmation not received within 1 minute, cancelling save.',
            components: [],
        });
    }
}

export { create, invoke };
````

## File: events/commands/start.js
````javascript
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { sharedData } from '../../sharedData.js';

/**
 * Creates a new Slash Command for starting a game.
 *
 * @return {Object} The JSON representation of the created command.
 */

const create = () => {
    const command = new SlashCommandBuilder()
        .setName('start')
        .setDescription(
            'Start a game. If not set with `/channel` the game will run in the current channel.'
        );

    command.addStringOption((option) =>
        option
            .setName('game')
            .setDescription('Game to start.')
            .setRequired(true)
    );

    let x, current;
    for (x = 0; x < sharedData.gameList.games.length; x++) {
        current = sharedData.gameList.games[x];
        command.options[0].addChoices(
            JSON.parse(`{"name": "${current.name}", "value": "${current.id}"}`)
        );
    }

    return command.toJSON();
};

/**
 * Invokes the specified interaction.
 *
 * @param {object} interaction - The interaction object to be invoked.
 */
const invoke = (interaction) => {
    const game = interaction.options.getString('game') ?? 'No game provided';

    if (sharedData.gameActive) {
        interaction.reply({
            content:
                'A game is already running. You must stop the current game before starting a new one.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (sharedData.channel === null) {
        // Start the game in the current channel
        sharedData.channel = interaction.channel;
    }

    let gameObj = sharedData.gameList.games.filter((it) => it.id === game)[0];

    interaction.reply({
        content:
            'Starting ' +
            gameObj.name +
            ' in <#' +
            sharedData.channel.id +
            '>.',
        flags: MessageFlags.Ephemeral,
    });

    if (!sharedData.frotzClient.startGame(gameObj.file)) {
        interaction.reply({
            content: sharedData.frotzClient.lastError.message,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    sharedData.gameId = game;
    sharedData.gameActive = true;
    sharedData.listenToGame = true;
};

export { create, invoke };
````

## File: events/commands/status.js
````javascript
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Import the shared data object
import { sharedData } from '../../sharedData.js';

// Creates an Object in JSON with the data required by Discord's API to create a SlashCommand
const create = () => {
    const command = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show bot status.');

    return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = (interaction) => {
    let embed = new EmbedBuilder()
        .setTitle('Frotz Bot Status')
        .setColor(0x0099ff);

    let names = '', values = '';

    names += 'Game ID\n';
    names += 'Channel\n';
    names += 'Listening to Game\n';
    names += 'Game Active\n';

    values += sharedData.gameId == null ? 'No game selected\n' : sharedData.gameId + '\n';
    values += sharedData.channel == null ? 'No channel selected\n' : sharedData.channel.name + '\n';
    values += sharedData.listenToGame + '\n';
    values += sharedData.gameActive + '\n';

    embed.addFields([
        {
            name: 'Name',
            value: names,
            inline: true
        },
        {
            name: 'Value',
            value: values,
            inline: true
        },
    ]);

    interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
};

export { create, invoke };
````

## File: events/interactionCreate.js
````javascript
import { sharedData } from '../sharedData.js';
import { Logger } from '../logger.js';


const once = false;
const name = 'interactionCreate';

/**
 * Check if the interaction is a command and call the invoke method in the corresponding file.
 *
 * @param {object} interaction - The interaction object.
 * @return {Promise} A promise that resolves when the invoke method is called.
 */
async function invoke(interaction) {
    // Check if the interaction is a command and call the invoke method in the corresponding file
    // The #commands ES6 import-abbreviation is defined in the package.json
    if (interaction.isChatInputCommand())
        (await import(`#commands/${interaction.commandName}`)).invoke(interaction);
}

// Send command to dfrotz when a message is received if the game is active
sharedData.client.on('messageCreate', (message) => {
    // Only process messages if we are actively playing and the message is sent in the game channel
    if (sharedData.gameActive && sharedData.listenToGame && message.channel.id === sharedData.channel.id) {

        // Do nothing if the message is sent by the bot
        if (message.author.id == sharedData.client.user.id) {
            return;
        }

        // disable save in favor of the slash command
        if (message.content.match(/^(save)/i)) {
            sharedData.channel.send('Use `/save` to save the game.');
            return;
        }

        // disable restore in favor of the slash command
        if (message.content.match(/^(restore)/i)) {
            sharedData.channel.send('Use `/restore` to restore a saved game.');
            return;
        }

        // disable quit in favor of the slash command
        if (message.content.match(/^(quit)/i) || message.content.match(/^(q)/i)) {
            sharedData.channel.send('Use `/quit` to exit the game.');
            return;
        }

        // Send message to dfrotz
        sharedData.frotzClient.processInput(message.content);
    }
});

export { once, name, invoke };
````

## File: events/ready.js
````javascript
import fs from 'fs';
import { Logger } from '../logger.js';

const once = true;
const name = 'ready';

/**
 * Invokes the client by loading commands from the './events/commands' directory
 * and sets them as application commands. It also logs a success message after
 * the client is logged in.
 *
 * @param {Object} client - The client object representing the Discord bot.
 * @return {Promise<void>} - A promise that resolves once the commands are set.
 */
async function invoke(client) {
    const commands = fs
        .readdirSync('./events/commands')
        .filter((file) => file.endsWith('.js'))
        .map((file) => file.slice(0, -3));

    const commandsArray = [];

    for (let command of commands) {
        const commandFile = await import(`#commands/${command}`);
        commandsArray.push(commandFile.create());
    }

    client.application.commands.set(commandsArray);

    Logger.log({
        level: 'info',
        message: `Successfully logged in as ${client.user.tag}!`
    });
}

export { once, name, invoke };
````

## File: games/games.json.template
````
{
    "games" : [
        {
            "id": "id",
            "name": "name",
            "file": "file"
        }
    ]
}
````

## File: games/games.md
````markdown
## Configuring Games

Place games files in this folder (or in the folder you specified with `GAME_FOLDER` in `.env`). 
Game files should conform to the Z-Machine standard. V1-V5 files are supported.

Create a `games.json` file int the the folder using `games.json.template` as a template

Create an entry for each game file, with the following values set for each game.
You can at up to 25 games. 

- `id`: Short game identifier (e.g. "game1").  The ID must contain only letters and numbers. 
- `name`: Descriptive name for the game (e.g. "The Game: A Cool Text Adventure"). 256 characters max. 
- `file`: Game data file (e.g. "game.z3").
````

## File: tests/events/commands/channel.test.js
````javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/channel.js';
import { sharedData } from '../../../sharedData.js';

// Mock dependencies
vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        channel: null,
    },
}));

vi.mock('discord.js', () => {
    return {
        SlashCommandBuilder: vi.fn(),
        ChannelType: {
            GuildText: 0,
        },
        MessageFlags: {
            Ephemeral: 64,
        },
    };
});

describe('channel command', () => {
    let mockInteraction;

    beforeEach(() => {
        // Reset the channel to null before each test
        sharedData.channel = null;

        // Create a mock interaction with necessary methods and properties
        mockInteraction = {
            options: {
                getChannel: vi.fn(),
            },
            channel: {
                id: 'current-channel-id',
                name: 'current-channel',
            },
            reply: vi.fn(),
        };
    });

    it('should set the channel to the provided channel', () => {
        // Mock the getChannel method to return a specific channel
        const mockChannel = {
            id: 'specified-channel-id',
            name: 'specified-channel',
        };
        mockInteraction.options.getChannel.mockReturnValue(mockChannel);

        // Call the invoke function
        invoke(mockInteraction);

        // Verify that sharedData.channel is set to the specified channel
        expect(sharedData.channel).toBe(mockChannel);

        // Verify that the interaction reply was called with the correct message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'Game channel set to <#specified-channel-id>.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });

    it('should default to the current channel if no channel is provided', () => {
        // Mock the getChannel method to return null
        mockInteraction.options.getChannel.mockReturnValue(null);

        // Call the invoke function
        invoke(mockInteraction);

        // Verify that sharedData.channel is set to the current channel
        expect(sharedData.channel).toBe(mockInteraction.channel);

        // Verify that the interaction reply was called with the correct message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'Game channel set to <#current-channel-id>.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });
});
````

## File: tests/events/commands/games.test.js
````javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/games.js';

vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        gameList: {
            games: [
                { id: 'game1', name: 'Zork I' },
                { id: 'game2', name: 'Adventure' },
            ],
        },
    },
}));

vi.mock('discord.js', () => {
    return {
        EmbedBuilder: vi.fn().mockImplementation(() => ({
            setTitle: vi.fn().mockReturnThis(),
            setDescription: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            addFields: vi.fn().mockReturnThis(),
        })),
        SlashCommandBuilder: vi.fn(),
    };
});

describe('games command', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = {
            reply: vi.fn(),
        };
    });

    it('should list available games', () => {
        invoke(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                ephemeral: true,
            })
        );
    });
});
````

## File: tests/events/commands/pause.test.js
````javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update paths to be absolute rather than relative
const pauseCommandPath = path.resolve(
    __dirname,
    '../../../events/commands/pause.js'
);
const sharedDataPath = path.resolve(__dirname, '../../../sharedData.js');

// Mock dependencies with proper exports
vi.mock('discord.js', () => {
    return {
        SlashCommandBuilder: vi.fn(),
        MessageFlags: {
            Ephemeral: 64,
        },
        ButtonBuilder: vi.fn().mockImplementation(() => ({
            setCustomId: vi.fn().mockReturnThis(),
            setLabel: vi.fn().mockReturnThis(),
            setStyle: vi.fn().mockReturnThis(),
        })),
        ButtonStyle: {
            Danger: 4,
            Secondary: 2,
        },
        ActionRowBuilder: vi.fn().mockImplementation(() => ({
            addComponents: vi.fn().mockReturnThis(),
        })),
    };
});

vi.mock(sharedDataPath, () => ({
    sharedData: {
        gameActive: true,
        listenToGame: true,
        gameId: 'test-game',
        gameList: {
            games: [{ id: 'test-game', name: 'Test Game' }],
        },
    },
}));

// Now import the module under test AFTER the mocks are set up
const { invoke } = await import(pauseCommandPath);
const { sharedData } = await import(sharedDataPath);

describe('pause command', () => {
    let mockInteraction;
    let mockConfirmation;
    let mockResponse;

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();

        // Reset the listenToGame state before each test
        sharedData.gameActive = true;
        sharedData.listenToGame = true;

        // Set up mock response for the initial interaction reply
        mockResponse = {
            awaitMessageComponent: vi.fn(),
        };

        // Set up mock interaction
        mockInteraction = {
            reply: vi.fn().mockResolvedValue(mockResponse),
            editReply: vi.fn().mockResolvedValue({}),
            user: { id: 'test-user-id' },
        };

        // Set up mock confirmation (for button clicks)
        mockConfirmation = {
            customId: '',
            update: vi.fn().mockResolvedValue({}),
        };
    });

    it('should show an error if no game is running', async () => {
        // Set gameActive to false to simulate no running game
        sharedData.gameActive = false;

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the "no game running" message
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: 'No game is currently running.',
            flags: 64, // MessageFlags.Ephemeral
        });
    });

    it('should pause the game when confirm button is clicked', async () => {
        // Mock the awaitMessageComponent to simulate a user clicking the confirm button
        mockConfirmation.customId = 'confirm';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the confirmation prompt
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Are you sure you want to pause the game?'
                ),
                components: expect.any(Array),
            })
        );

        // Verify that listenToGame was toggled to false (paused)
        expect(sharedData.listenToGame).toBe(false);

        // Verify that the confirmation was updated with the proper message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Game paused'),
                components: [],
            })
        );
    });

    it('should unpause the game when already paused', async () => {
        // Set up the initial state to be paused
        sharedData.listenToGame = false;

        // Mock the awaitMessageComponent to simulate a user clicking the confirm button
        mockConfirmation.customId = 'confirm';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called with the unpause confirmation prompt
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Are you sure you want to unpause the game?'
                ),
                components: expect.any(Array),
            })
        );

        // Verify that listenToGame was toggled to true (unpaused)
        expect(sharedData.listenToGame).toBe(true);

        // Verify that the confirmation was updated with the proper message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Game unpaused'),
                components: [],
            })
        );
    });

    it('should do nothing when cancel button is clicked', async () => {
        // Record the initial state
        const initialListenState = sharedData.listenToGame;

        // Mock the awaitMessageComponent to simulate a user clicking the cancel button
        mockConfirmation.customId = 'cancel';
        mockResponse.awaitMessageComponent.mockResolvedValue(mockConfirmation);

        await invoke(mockInteraction);

        // Verify the interaction reply was called
        expect(mockInteraction.reply).toHaveBeenCalled();

        // Verify that listenToGame was not changed
        expect(sharedData.listenToGame).toBe(initialListenState);

        // Verify that the confirmation was updated with the cancellation message
        expect(mockConfirmation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Pause state toggle cancelled.',
                components: [],
            })
        );
    });

    it('should handle timeout if no button is clicked', async () => {
        // Mock the awaitMessageComponent to simulate a timeout
        mockResponse.awaitMessageComponent.mockRejectedValue(
            new Error('Timeout')
        );

        await invoke(mockInteraction);

        // Verify the interaction reply was called
        expect(mockInteraction.reply).toHaveBeenCalled();

        // Verify that editReply was called with the timeout message
        expect(mockInteraction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(
                    'Confirmation not received within 1 minute'
                ),
                components: [],
            })
        );
    });
});
````

## File: tests/events/commands/status.test.js
````javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../../events/commands/status.js';

// Mock dependencies
vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        gameId: 'test-game',
        channel: { name: 'test-channel' },
        listenToGame: true,
        gameActive: true,
    },
}));

vi.mock('discord.js', () => {
    return {
        EmbedBuilder: vi.fn().mockImplementation(() => ({
            setTitle: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            addFields: vi.fn().mockReturnThis(),
        })),
        SlashCommandBuilder: vi.fn(),
    };
});

describe('status command', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = {
            reply: vi.fn(),
        };
    });

    it('should reply with current bot status', () => {
        invoke(mockInteraction);

        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                ephemeral: true,
            })
        );
    });
});
````

## File: tests/cleanAnsi.test.js
````javascript
import { describe, it, expect } from 'vitest';
import { CleanAnsi } from '../cleanAnsi.js';

describe('CleanAnsi', () => {
    describe('replace', () => {
        it('should replace ANSI color codes with empty strings', () => {
            const input = '\x1B[31mRed text\x1B[0m';
            const expected = 'Red text[reset]';
            expect(CleanAnsi.replace(input)).toBe(expected);
        });

        it('should replace multiple ANSI codes correctly', () => {
            const input = '\x1B[1mBold\x1B[22m \x1B[4mUnderline\x1B[24m';
            const expected = '**Bold** *Underline*';
            expect(CleanAnsi.replace(input)).toBe(expected);
        });

        it('should handle text with no ANSI codes', () => {
            const input = 'Plain text';
            expect(CleanAnsi.replace(input)).toBe(input);
        });
    });

    describe('escapeRegex', () => {
        it('should escape special regex characters', () => {
            const input = '.+*?^$()[]{}|\\';
            const expected = '\\.\\+\\*\\?\\^\\$\\(\\)\\[\\]\\{\\}\\|\\\\';
            expect(CleanAnsi.escapeRegex(input)).toBe(expected);
        });
    });
});
````

## File: tests/frotzClient.test.js
````javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Frotz } from '../frotzClient.js';
import { EventEmitter } from 'node:events';

// Mock dependencies properly with hoisting in mind
vi.mock('child_process', () => {
    return {
        spawn: vi.fn(() => ({
            stdout: new EventEmitter(),
            stdin: { write: vi.fn() },
            kill: vi.fn(),
        })),
    };
});

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
    },
    existsSync: vi.fn(),
}));

vi.mock('../sharedData.js', () => ({
    sharedData: {
        gameFolder: '/test/games',
        channel: {
            send: vi.fn().mockResolvedValue({}),
        },
    },
}));

// Import the mocks after they've been defined
import { spawn } from 'child_process';
import fs from 'fs';
describe('FrotzClient', () => {
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset client state
        Frotz.dFrotz = null;
        Frotz.rawOutput = '';
        Frotz.compiledOutput = '';

        // Set default mock returns
        fs.existsSync.mockReturnValue(true);
    });

    describe('verifyGameFile', () => {
        it('should return true if the file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = Frotz.verifyGameFile('/test/game.z5');

            expect(result).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith('/test/game.z5');
        });

        it('should return false if the file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = Frotz.verifyGameFile('/test/nonexistent.z5');

            expect(result).toBe(false);
            expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent.z5');
        });
    });

    describe('startGame', () => {
        it('should return false if game file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = Frotz.startGame('nonexistent.z5');

            expect(result).toBe(false);
            expect(Frotz.lastError).toBeDefined();
            expect(spawn).not.toHaveBeenCalled();
        });

        it('should spawn dfrotz process if game file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = Frotz.startGame('zork1.z5');

            expect(result).toBe(true);
            expect(spawn).toHaveBeenCalledWith(
                'dfrotz',
                expect.arrayContaining(['/test/games/zork1.z5'])
            );
        });
    });

    // Add more test cases for other methods...
});
````

## File: .env.template
````
DISCORD_TOKEN=your-token-goes-here
GAME_FOLDER=./games
````

## File: .gitignore
````
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# Bower dependency directory (https://bower.io/)
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons (https://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)
web_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next
out

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
# Comment in the public line in if your project uses Gatsby and not Next.js
# https://nextjs.org/blog/next-9-1#public-directory-support
# public

# vuepress build output
.vuepress/dist

# vuepress v2.x temp and cache directory
.temp
.cache

# Docusaurus cache and generated files
.docusaurus

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# yarn v2
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*

# dotenv
.env

# logs
logs/*.log

# game config, games and saves
games/games.json
games/*.z*
games/*.Z*
games/*.qzl
````

## File: cleanAnsi.js
````javascript
/**
 * The default escape code replacement map used by `replaceAnsiCodes`
 */
const replaceCodeList = {
    // Color codes
    '\x1B[30m': '',         // Black
    '\x1B[31m': '',         // Red
    '\x1B[32m': '',         // Green
    '\x1B[33m': '',         // Yellow
    '\x1B[34m': '',         // [blue
    '\x1B[35m': '',         // Magenta
    '\x1B[36m': '',         // Cyan
    '\x1B[37m': '',         // White

    '\x1B[30;1m': '',       // Bright Black
    '\x1B[31;1m': '',       // Bright Red
    '\x1B[32;1m': '',       // Bright Green
    '\x1B[33;1m': '',       // Bright Yellow
    '\x1B[34;1m': '',       // Bright Blue
    '\x1B[35;1m': '',       // Bright Magenta
    '\x1B[36;1m': '',       // Bright Cyan
    '\x1B[37;1m': '',       // Bright White

    '\x1B[40m': '',         // Background Black
    '\x1B[41m': '',         // Background Red
    '\x1B[42m': '',         // Background Green
    '\x1B[43m': '',         // Background Yellow
    '\x1B[44m': '',         // Background Blue
    '\x1B[45m': '',         // Background Magenta
    '\x1B[46m': '',         // Background Cyan
    '\x1B[47m': '',         // Background White

    '\x1B[39m': '',         // Reset color
    '\x1B[49m': '',         // Reset background color

    // Clear codes
    '\x1B[0K': '',          // Clear to end of line

    // Text formatting codes
    '\x1B[1m': '**',        // Bold
    '\x1B[22m': '**',       // Reset Bold
    '\x1B[4m': '*',         // Underline
    '\x1B[24m': '*',        // Reset Underline
    '\x1B[7m': '[rev]',     // Reversed     
    '\x1B[27m': '',         // Positive (not inverse)

    '\x1B[0m': '[reset]',
    '\x1B[m': '[reset-short]',
};

class CleanAnsiClass {
    escapeRegex(str) {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    /**
     * Replace ANSI escape codes in `str` with replacements in replaceCodeList,
     *
     * @param {string} str The string to replace stuff in.
     * @returns {string} The string with replacements applied.
     */
    replace(str) {
        let out = str;

        for (const [key, value] of Object.entries(replaceCodeList)) {
            out = out.replace(new RegExp(this.escapeRegex(key), 'g'), value);
        }

        return out;
    }
}
export const CleanAnsi = new CleanAnsiClass();
````

## File: eslint.config.mjs
````
import globals from "globals";

export default [{
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.commonjs,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        indent: ["error", 4],
        "linebreak-style": ["error", "unix"],
        quotes: ["error", "single"],
        semi: ["error", "always"],
    },
}, {
    files: ["**/.eslintrc.{js,cjs}"],
}];
````

## File: frotz-bot.js
````javascript
import { } from 'dotenv/config';
import fs from 'fs';
import { Client, GatewayIntentBits } from 'discord.js';
import { sharedData } from './sharedData.js';

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

sharedData.client = client;

// Fetch all js files in ./events
const events = fs
    .readdirSync('./events')
    .filter((file) => file.endsWith('.js'));

// Check for an event and execute the corresponding file in ./events
for (let event of events) {
    // The #events ES6 import-abbreviation is defined in the package.json
    // Note that the entries in the list of files (created by readdirSync) end with .js,
    // so the abbreviation is different to the #commands abbreviation
    const eventFile = await import(`#events/${event}`);
    // But first check if it's an event emitted once
    if (eventFile.once)
        client.once(eventFile.name, (...args) => {
            eventFile.invoke(...args);
        });
    else
        client.on(eventFile.name, (...args) => {
            eventFile.invoke(...args);
        });
}

// Login with the environment data
client.login(process.env.BOT_TOKEN);
````

## File: frotzClient.js
````javascript
import { sharedData } from './sharedData.js';
import {} from 'dotenv/config';
import { Logger } from './logger.js';
import { StringDecoder } from 'string_decoder';
import { spawn } from 'child_process';
import fs from 'fs';
import { CleanAnsi } from './cleanAnsi.js';

class FrotzClient {
    dFrotz = null;
    rawOutput = '';
    compiledOutput = '';
    gamePath = '';
    gameHeader = '';

    lastError = null;
    decoder = new StringDecoder('utf8');

    /**
     * Verifies if the game file exists at the given file path.
     *
     * @param {string} filePath - The path to the game file.
     * @return {boolean} Returns true if the game file exists, otherwise false.
     */
    verifyGameFile(filePath) {
        return fs.existsSync(filePath);
    }

    /**
     * Starts the game specified by the given game file.
     *
     * @param {string} gameFile - The name of the game file.
     * @return {boolean} Returns false if the game file does not exist, otherwise returns true.
     */
    startGame(gameFile) {
        this.gamePath = sharedData.gameFolder + '/' + gameFile;

        if (!this.verifyGameFile(this.gamePath)) {
            Logger.log({
                level: 'warn',
                message: `Failed to launch Frotz: the game file ${gameFile} does not exist.`,
            });
            this.lastError = new Error(
                `Failed to launch Frotz: the game file ${gameFile} does not exist.`
            );
            return false;
        }

        Logger.log({
            level: 'info',
            message: `Launching Frotz: ${this.gamePath}`,
        });

        // Create dFrotz child process for the game
        // -p   plain ASCII output only
        // -m   turn off MORE prompts
        // -R   restrict Frotz read/write to the specified folder
        // -Z   Suppress errors in output
        this.dFrotz = spawn('dfrotz', [
            '-f',
            'ansi',
            '-m',
            '-Z',
            '0',
            '-R',
            sharedData.gameFolder,
            this.gamePath,
        ]);

        // Create Frotz child process for the game
        //this.dFrotz = spawn('frotz', ['-p', '-Z', '0', '-R', sharedData.gameFolder, this.gamePath]);

        // Setup stream from frotz's stdout so that we can get its output
        this.dFrotz.stdout.on('data', (chunk) => {
            this.receiveFrotzOutput(chunk);
        });

        return true;
    }

    /**
     * Receives a chunk of data from the dfrotz output and processes it.
     *
     * @param {chunk} chunk - The chunk of data received from the dfrotz output.
     * @return None
     */
    receiveFrotzOutput(chunk) {
        let _string = this.decoder.write(chunk);

        this.rawOutput += _string;

        // this marks the end of input
        if (/(\n>)/.exec(this.rawOutput)) {
            this.cleanUpOutput();
        }
    }

    /**
     * Clean up the output by removing certain elements.
     *
     * @param {string} raw - The raw output to clean up.
     * @return {string} The cleaned up output.
     */
    cleanUpOutput() {
        let splitRaw = this.rawOutput.split(/\n/g);
        let outputArray = '';

        for (const element of splitRaw) {
            let cleanedElement = CleanAnsi.replace(element);

            if (this.shouldSkipElement(cleanedElement)) {
                continue;
            }

            if (cleanedElement.trim().startsWith('[rev]')) {
                this.gameHeader = cleanedElement
                    .substring(5, cleanedElement.length)
                    .trim();
                continue;
            }

            if (cleanedElement.trim().length === 0) {
                this.compiledOutput = outputArray;
                this.sendOutput();
                outputArray = '';
                continue;
            }

            outputArray += cleanedElement.trimEnd() + ' \n';
        }

        this.rawOutput = '';
        if (outputArray.length > 0) {
            this.compiledOutput = outputArray;
            this.sendOutput();
        }
    }

    shouldSkipElement(element) {
        const trimmedElement = element.trim();
        return (
            trimmedElement === 'Using ANSI formatting.' ||
            trimmedElement === 'Loading ' + this.gamePath + '.' ||
            trimmedElement.startsWith('Please enter a filename [') ||
            trimmedElement === '>' ||
            trimmedElement.length === 0
        );
    }

    /**
     * Sends the game output to the channel, splitting into multiple messages if needed.
     * Discord has a 2000 character limit per message.
     */
    sendOutput() {
        let final = Buffer.from(this.compiledOutput, 'utf-8').toString();

        // Don't send empty output
        if (final.length === 0) {
            return;
        }

        // Check if the message is too long for Discord (2000 char limit)
        if (final.length <= 1900) {
            // Short enough to send as a single message
            sharedData.channel.send(final).catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending message to Discord: ${error.message}`,
                    stack: error.stack,
                });
            });
        } else {
            // Split the message into chunks of ~1900 characters
            // Try to split at paragraph boundaries when possible
            this.sendLongMessage(final);
        }

        this.compiledOutput = '';
    }

    /**
     * Splits a long message into multiple chunks and sends them sequentially
     *
     * @param {string} text - The full text to send
     */
    sendLongMessage(text) {
        const MAX_CHUNK_SIZE = 1900;
        const paragraphs = text.split(/\n\s*\n/);
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (this.isChunkTooLarge(currentChunk, paragraph, MAX_CHUNK_SIZE)) {
                this.sendChunk(currentChunk);
                currentChunk = '';

                if (paragraph.length > MAX_CHUNK_SIZE) {
                    this.splitAndSendParagraph(paragraph, MAX_CHUNK_SIZE);
                } else {
                    this.sendChunk(paragraph);
                }
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk.length > 0) {
            this.sendChunk(currentChunk);
        }
    }

    isChunkTooLarge(currentChunk, paragraph, maxSize) {
        return currentChunk.length + paragraph.length + 2 > maxSize;
    }

    sendChunk(chunk) {
        if (chunk.length > 0) {
            sharedData.channel.send(chunk).catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending chunk to Discord: ${error.message}`,
                    stack: error.stack,
                });
            });
        }
    }

    splitAndSendParagraph(paragraph, maxSize) {
        const lines = paragraph.split(/\n/);
        let lineChunk = '';

        for (const line of lines) {
            if (this.isChunkTooLarge(lineChunk, line, maxSize)) {
                this.sendChunk(lineChunk);
                lineChunk = '';

                if (line.length > maxSize) {
                    this.splitAndSendLine(line, maxSize);
                } else {
                    lineChunk = line;
                }
            } else {
                lineChunk += (lineChunk ? '\n' : '') + line;
            }
        }

        if (lineChunk.length > 0) {
            this.sendChunk(lineChunk);
        }
    }

    splitAndSendLine(line, maxSize) {
        for (let i = 0; i < line.length; i += maxSize) {
            const textChunk = line.substring(
                i,
                Math.min(i + maxSize, line.length)
            );
            this.sendChunk(textChunk);
        }
    }

    /**
     * Send the input message to dfrotz.
     *
     * @param {string} message - The input message to be processed.
     */
    processInput(message) {
        this.dFrotz.stdin.write(message + '\n');
    }

    /**
     * Stops the game and performs cleanup of the dfrotz child process.
     */
    stopGame() {
        // cleanup the child process
        this.dFrotz.kill();
    }

    /**
     * Save the game at the specified path.
     *
     * @param {string} savePath - The path where the game should be saved.
     */
    saveGame(savePath) {
        this.dFrotz.stdin.write('save\n');
        this.dFrotz.stdin.write(savePath + '\n');
    }

    /**
     * Restore the game from the specified path.
     *
     * @param {string} savePath - The path to teh save file to be restored.
     */
    restoreGame(savePath) {
        this.dFrotz.stdin.write('restore\n');
        this.dFrotz.stdin.write(savePath + '\n');
    }
}

export const Frotz = new FrotzClient();
````

## File: LICENSE
````
MIT License

Copyright (c) 2023 Random Lunacy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
````

## File: logger.js
````javascript
import winston from 'winston';

export const Logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.log`
        // - Write all logs with importance level of `info` or less to `combined.log`
        //
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/combined.log', level: 'debug' }),
        new winston.transports.Console({ format: winston.format.simple() })
    ],
});
````

## File: package.json
````json
{
    "name": "discord-frotz-bot",
    "version": "1.0.0",
    "description": "Discord bot to interface with dfrotz",
    "main": "frotz-bot.js",
    "scripts": {
        "start": "node ./frotz-bot.js",
        "lint": "node_modules/.bin/eslint ./*.js events/*.js events/**/*.js",
        "lint-fix": "node_modules/.bin/eslint ./*.js events/*.js events/**/*.js --fix",
        "test": "vitest run",
        "test:watch": "vitest",
        "coverage": "vitest run --coverage"
    },
    "author": "NepoKama",
    "license": "MIT",
    "dependencies": {
        "dateformat": "^5.0.3",
        "discord.js": "^14.18.0",
        "dotenv": "^16.4.7",
        "glob": "^11.0.1",
        "winston": "^3.17.0"
    },
    "imports": {
        "#events/*": "./events/*",
        "#commands/*": "./events/commands/*.js"
    },
    "type": "module",
    "devDependencies": {
        "@vitest/coverage-v8": "^3.1.1",
        "eslint": "^9.23.0",
        "globals": "^16.0.0",
        "vitest": "^3.1.1"
    }
}
````

## File: README.md
````markdown
# discord-frotz-bot

<!-- ABOUT THE PROJECT -->

## About The Project

This project enables you to host and run interactive fiction games on Discord using [Frotz](https://661.org/proj/if/frotz/), a popular Z-machine interpreter. Most interactive fiction games with a `.z[number]`
file extension should work correctly.

<!-- GETTING STARTED -->

## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Prerequisites

-   [Node.JS](https://nodejs.org/)

    Verify you have Node.js 22.12.0 or later installed:

    ```sh
    node --version
    ```

-   [NPM](https://www.npmjs.com/)

    Verify you have NPM installed:

    ```sh
    npm --version
    ```

-   [Frotz](https://661.org/proj/if/frotz/)

    This bot uses the `dfrotz` implementation of Frotz to run the interactive fiction games. Verify your Frotz installation by running the following command:

    ```sh
    dfrotz -v
    ```

### Configure a Discord Bot Account

Follow the steps for [Creating a Bot Account](https://discord.readthedocs.io/en/stable/discord.html) and connecting it
to your Discord server.

Once you've created your bot account in Discord you will need to enable the **Message Content Intent** under **Bot** ->
**Privileged Gateway Intents**.

When building a URL to invite the bot account to a server select **Read Messages/View Channels** and **Send Messages**
under **Bot Permissions**.

Make note of your bot’s token, you will need to add it to the configuration for `discord-frotz-bot`. Note that this
token is essentially your bot’s password. You should never commit this token to the repository or share this token with
anyone else.

### Installation

1. Clone the repo.
    ```sh
    git clone https://github.com/Random-Lunacy/discord-frotz-bot.git
    ```
2. Install NPM packages.
    ```sh
    cd discord-frotz-bot
    npm install
    ```
3. Create a `.env` file in the repository root from `.env.template`.
    ```sh
    cp .env.template .env
    ```
4. Edit the `.env` file and replace `your-token-goes-here` with your bot token.
5. Copy the Z-machine games files you want your bot to use to the `games` folder.
6. Create a `games.json` file in the `games` folder from `games/games.json.template`.
    ```sh
    cp games/games.json.template games/games.json
    ```
7. Edit `games.json` to include for your Z-machine games. See `games/games.md` for more information.
8. Start the bot with `npm run start`

<!-- USAGE EXAMPLES -->

## Usage

TODO: Add examples of how to use the bot.

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/Random-Lunacy/discord-frotz-bot/issues) for a full list of proposed features
(and known issues).

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/Random-Lunacy/discord-frotz-bot](https://github.com/Random-Lunacy/discord-frotz-bot)

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

-   Many thanks to the team who build and maintain [Frotz](https://661.org/proj/if/frotz/). Without their work
    this bot would not be possible.
````

## File: sharedData.js
````javascript
// Data shared across the bot
import { } from 'dotenv/config';
import fs from 'fs';
import { Frotz } from './frotzClient.js';

const data = fs.readFileSync(`${process.env.GAME_FOLDER}/games.json`);

// Define  shared data object
export const sharedData = {
    client: null,
    gameId: null,
    channel: null,
    gameFolder: process.env.GAME_FOLDER,
    gameList: JSON.parse(data),
    listenToGame: false,
    gameActive: false,
    frotzClient: Frotz,
};
````

## File: vitest.config.js
````javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/', 'coverage/', '**/*.config.js'],
        },
    },
});
````
