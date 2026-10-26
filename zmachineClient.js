import { sharedData } from './sharedData.js';
import {} from 'dotenv/config';
import { Logger } from './logger.js';
import fs from 'fs';
import { EventEmitter } from 'events';
import { BlorbParser, Logger as ZLogger, LogLevel, QuetzalFormat, ZMachine } from '@random-lunacy/rezrov-zmachine';
import { FileSystemProvider } from '@random-lunacy/rezrov-zmachine/node';
import { DiscordScreen } from './discordScreen.js';
import { DiscordInputProcessor } from './discordInputProcessor.js';
import {
    buildSaveName,
    DEFAULT_LABEL_TEMPLATE,
    describeSave,
    expandLabelTemplate,
    listSaves,
    preferChannel,
    sanitizeLabel,
} from './saves.js';

ZLogger.setLevel(LogLevel.WARN);

const MAX_RESTORE_CHOICES = 10;
const AUTOSAVE_LABEL = 'autosave';

// customId of the Continue button (handled in keyPrompt.js)
export const KEY_BUTTON_ID = 'anykey';

// The most "press any key" screens in a row that are skipped to reach a line prompt
const MAX_KEY_PROMPTS = 5;

/**
 * Plays one game in one Discord channel (or thread). Each running game has its own client.
 */
export class ZMachineClient extends EventEmitter {
    machine = null;
    screen = null;
    input = null;
    gamePath = '';
    lastUserId = null;
    pendingPrompt = null;

    promptTimeoutMs = 60_000;

    lastError = null;

    /**
     * @param {object} options
     * @param {object} options.channel - The Discord channel or thread the game is played in.
     * @param {string} options.gameId - The game's ID from games.json.
     * @param {string} [options.gameName] - The game's display name.
     */
    constructor({ channel, gameId, gameName }) {
        super();
        this.channel = channel;
        this.gameId = gameId;
        this.gameName = gameName ?? gameId;
    }

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
     * @return {boolean} Returns false if the game could not be started, otherwise returns true.
     */
    startGame(gameFile) {
        this.gamePath = sharedData.gameFolder + '/' + gameFile;

        if (!this.verifyGameFile(this.gamePath)) {
            const message = `Failed to start game: the game file ${gameFile} does not exist.`;
            Logger.log({ level: 'warn', message });
            this.lastError = new Error(message);
            return false;
        }

        Logger.log({
            level: 'info',
            message: `Starting game: ${this.gamePath}`,
        });

        try {
            let story = fs.readFileSync(this.gamePath);
            let blorbMap = null;
            let blorbData = null;
            if (BlorbParser.isBlorb(story)) {
                blorbMap = BlorbParser.parse(story);
                blorbData = story;
                story = BlorbParser.getExecData(blorbMap, story) ?? story;
            }

            this.screen = new DiscordScreen((text, status, block) =>
                this.sendOutput(text, status, block)
            );
            this.screen.onQuit = () => this.handleGameEnd();
            this.input = new DiscordInputProcessor(this.screen, {
                save: () => this.promptSaveName(),
                restore: () => this.promptRestoreName(),
                anyKey: () => this.postKeyPrompt(),
            });

            // Quetzal (.qzl) is the same save format dfrotz writes
            this.machine = new ZMachine(
                story,
                this.screen,
                this.input,
                undefined,
                new FileSystemProvider(),
                new QuetzalFormat()
            );
            this.input.machine = this.machine;
            if (blorbMap && blorbData) {
                this.machine.setBlorb(blorbMap, blorbData);
            }

            this.machine.execute();
        } catch (error) {
            Logger.log({
                level: 'error',
                message: `Failed to start game: ${error.message}`,
                stack: error.stack,
            });
            this.lastError = new Error(`Failed to start game: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Wait for the game to reach its first prompt.
     *
     * @param {number} [timeoutMs] - How long to wait.
     * @return {Promise<boolean>} False if the game was not ready in time.
     */
    async whenReady(timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (this.input?.waiting) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return false;
    }

    /**
     * Called when the game itself ends (for example, the player quits in-game).
     */
    handleGameEnd() {
        const name = this.gameName ?? 'The game';

        Logger.log({
            level: 'info',
            message: `Game ended: ${this.gameId} in ${this.channel.id}`,
        });

        this.cancelPrompt();
        this.clearKeyPrompt();
        this.machine = null;
        this.say(
            `**${name}** has ended. Use \`/start\` to play again or \`/restore\` to continue from a save.`
        );
        this.emit('end');
    }

    /**
     * Sends the game output to the channel, splitting into multiple messages if needed.
     * Discord has a 2000 character limit per message.
     *
     * @param {string} text - The text the game printed.
     * @param {string|null} status - The status line, if it has changed.
     * @param {string|null} [block] - Positioned text from the upper window (already in a code
     *     block), if it has changed. It is sent first, as a message of its own.
     */
    sendOutput(text, status, block = null) {
        if (this.silent) {
            return;
        }

        if (block) {
            this.sendChunk(block);
        }

        let final = status ? `-# ${status}\n${text}` : text;

        // Don't send empty output
        if (final.length === 0) {
            return;
        }

        // Check if the message is too long for Discord (2000 char limit)
        if (final.length <= 1900) {
            // Short enough to send as a single message
            this.channel.send(final).catch((error) => {
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
            this.channel.send(chunk).catch((error) => {
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
     * Handle a Discord message sent in the game channel. If the game has asked a player a
     * question (naming a save, choosing a save to restore), only that player's next message
     * is the answer; otherwise the message is a command for the game.
     *
     * @param {object} message - The Discord message.
     * @return {boolean} False if the game could not use the message.
     */
    handleMessage(message) {
        if (!this.machine) {
            return false;
        }

        if (this.pendingPrompt) {
            if (message.author.id === this.pendingPrompt.userId) {
                this.pendingPrompt.answer(message.content);
            }
            return true;
        }

        return this.processInput(message.content, message.author.id);
    }

    /**
     * Send the input message to the game.
     *
     * @param {string} message - The input message to be processed.
     * @param {string} [userId] - The user who sent it, used to name saves and ask them questions.
     * @return {boolean} False if the game is not waiting for input.
     */
    processInput(message, userId = null) {
        if (!this.machine) {
            return false;
        }
        const accepted = this.input.submit(message);
        if (accepted) {
            this.lastUserId = userId;
            this.clearKeyPrompt();
        }
        return accepted;
    }

    /**
     * Post the Continue button for a game that is waiting for any key. Discord has no key presses,
     * so the player can click the button or just type their next command.
     */
    postKeyPrompt() {
        if (this.silent) {
            return;
        }

        this.clearKeyPrompt();
        this.keyPromptMessage = this.channel
            .send({
                content: '-# Press Continue, or type your next command.',
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 1,
                                label: 'Continue',
                                custom_id: KEY_BUTTON_ID,
                            },
                        ],
                    },
                ],
            })
            .catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending the Continue button: ${error.message}`,
                    stack: error.stack,
                });
                return null;
            });
    }

    /**
     * Take the Continue button away once it has been answered.
     */
    clearKeyPrompt() {
        const posted = this.keyPromptMessage;
        this.keyPromptMessage = null;
        posted?.then((message) => message?.delete?.()).catch(() => {});
    }

    /**
     * Press a key for a game waiting on a "press any key" prompt (the Continue button).
     *
     * @param {string} userId - The user who pressed the button.
     * @return {boolean} False if the game is not waiting for any key any more.
     */
    pressKey(userId) {
        if (!this.machine || !this.input?.anyKeyPending) {
            return false;
        }
        return this.processInput('\r', userId);
    }

    /**
     * Press Enter at any "press any key" prompts so the game gets to a line prompt, where
     * `save` or `restore` can be typed. Players' typing is not affected.
     *
     * @return {Promise<boolean>} False if the game did not become ready.
     */
    async passAnyKeyPrompts() {
        for (let i = 0; i < MAX_KEY_PROMPTS && this.input?.anyKeyPending; i++) {
            this.input.submit('\r');
            this.clearKeyPrompt();
            if (!(await this.whenReady())) {
                return false;
            }
        }
        return true;
    }

    /**
     * Save the game without asking anyone or posting anything, for when the channel can no longer
     * be used (the thread has been archived). The save is named like a player's, labelled
     * "autosave", and shows up in the restore list.
     *
     * @param {string} userId - The user to record as having saved, such as whoever played last.
     * @return {Promise<string|null>} The path saved to, or null if the game could not be saved.
     */
    async autoSave(userId) {
        if (!this.machine) {
            return null;
        }

        this.silent = true;
        try {
            // A question waiting on a player will never be answered now
            this.cancelPrompt();
            if (!(await this.whenReady()) || !(await this.passAnyKeyPrompts())) {
                return null;
            }

            const savePath = `${sharedData.gameFolder}/${buildSaveName({
                gameId: this.gameId,
                channelId: this.channel.id,
                userId,
                time: Math.floor(Date.now() / 1000),
                label: AUTOSAVE_LABEL,
            })}`;

            this.input.setNextFilename(savePath);
            this.input.submit('save');

            // The game is back at its prompt once it has finished writing the save
            if (!(await this.whenReady())) {
                return null;
            }
            return fs.existsSync(savePath) ? savePath : null;
        } finally {
            this.silent = false;
        }
    }

    /**
     * Stops the game and releases the interpreter.
     */
    stopGame() {
        this.cancelPrompt();
        this.clearKeyPrompt();
        if (this.machine) {
            this.input.cancelInput(this.machine);
            this.machine.quit();
            this.machine = null;
        }
    }

    /**
     * Send a message to the game channel without pinging anyone it mentions.
     *
     * @param {string} content - The message.
     */
    say(content) {
        if (this.silent) {
            return;
        }

        this.channel
            .send({ content, allowedMentions: { parse: [] } })
            .catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending message to Discord: ${error.message}`,
                    stack: error.stack,
                });
            });
    }

    /**
     * Wait for the next message from a player.
     *
     * @param {string} userId - The only user whose message counts as an answer.
     * @return {Promise<string|null>} The text of the answer, or null if none arrived in time.
     */
    askUser(userId) {
        this.cancelPrompt();
        return new Promise((resolve) => {
            const finish = (answer) => {
                clearTimeout(timer);
                this.pendingPrompt = null;
                resolve(answer);
            };
            const timer = setTimeout(() => finish(null), this.promptTimeoutMs);
            this.pendingPrompt = {
                userId,
                answer: (text) => finish(text.trim()),
                cancel: () => finish(null),
            };
        });
    }

    cancelPrompt() {
        this.pendingPrompt?.cancel();
    }

    /**
     * Ask the player who typed `save` what to call the save, and work out where to put it.
     *
     * @return {Promise<string>} The path to save to, or '' to cancel the save.
     */
    async promptSaveName() {
        const userId = this.lastUserId;
        const defaultLabel = this.defaultLabel(userId);
        this.say(
            `<@${userId}> Name this save, reply \`skip\` to name it \`${defaultLabel}\`, ` +
                'or reply `cancel` to cancel. Only your reply will be used.'
        );

        const answer = await this.askUser(userId);
        if (answer !== null && answer.toLowerCase() === 'cancel') {
            this.say('Save cancelled.');
            return '';
        }

        let label = defaultLabel;
        if (answer === null) {
            this.say('No reply received, using the default name.');
        } else if (answer.toLowerCase() !== 'skip') {
            label = sanitizeLabel(answer);
            if (!label) {
                label = defaultLabel;
                this.say('That name has no usable letters or numbers, using the default name.');
            }
        }

        const name = buildSaveName({
            gameId: this.gameId,
            channelId: this.channel.id,
            userId,
            time: Math.floor(Date.now() / 1000),
            label,
        });
        this.say(`Saving as "${label}".`);
        return `${sharedData.gameFolder}/${name}`;
    }

    /**
     * The name a save gets when the player doesn't give one, from DEFAULT_SAVE_NAME if set.
     *
     * @param {string} userId - The player saving.
     * @return {string} The label.
     */
    defaultLabel(userId) {
        const user = sharedData.client?.users?.cache?.get(userId);
        const label = expandLabelTemplate(
            process.env.DEFAULT_SAVE_NAME || DEFAULT_LABEL_TEMPLATE,
            {
                game: this.gameId,
                user: user?.username ?? 'player',
                channel: this.channel?.name,
            }
        );
        return label || expandLabelTemplate(DEFAULT_LABEL_TEMPLATE, { user: 'player' });
    }

    /**
     * Ask the player who typed `restore` which save of this game to restore.
     *
     * @return {Promise<string>} The path to restore from, or '' to cancel the restore.
     */
    async promptRestoreName() {
        const userId = this.lastUserId;
        // Saves made in this thread come first
        const saves = preferChannel(
            listSaves(sharedData.gameFolder, this.gameId),
            this.channel.id
        ).slice(0, MAX_RESTORE_CHOICES);

        if (saves.length === 0) {
            this.say('There are no saves for this game.');
            return '';
        }

        const lines = saves.map(
            (save, index) => `${index + 1}. ${describeSave(save)}`
        );
        this.say(
            `<@${userId}> Which save do you want to restore?\n${lines.join('\n')}\n` +
                'Reply with a number, `latest`, or `cancel`. Only your reply will be used.'
        );

        const answer = await this.askUser(userId);
        let chosen = null;
        if (answer !== null) {
            if (answer.toLowerCase() === 'latest') {
                chosen = saves[0];
            } else if (/^\d+$/.test(answer)) {
                chosen = saves[parseInt(answer, 10) - 1] ?? null;
            }
        }

        if (!chosen) {
            this.say('Restore cancelled.');
            return '';
        }
        return chosen.path;
    }

    /**
     * Restore the game from the specified path (used by the /restore command).
     *
     * @param {string} savePath - The path to the save file to be restored.
     * @return {Promise<boolean>} False if the game was not ready to restore.
     */
    async restoreGame(savePath) {
        if (!(await this.passAnyKeyPrompts())) {
            return false;
        }
        this.input.setNextFilename(savePath);
        this.input.submit('restore');
        return true;
    }
}
