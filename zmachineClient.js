import { sharedData } from './sharedData.js';
import {} from 'dotenv/config';
import { Logger } from './logger.js';
import fs from 'fs';
import { EventEmitter } from 'events';
import {
    BlorbParser,
    FileSystemProvider,
    Logger as ZLogger,
    LogLevel,
    QuetzalFormat,
    ZMachine,
} from 'rezrov-zmachine';
import { DiscordScreen } from './discordScreen.js';
import { DiscordInputProcessor } from './discordInputProcessor.js';

ZLogger.setLevel(LogLevel.WARN);

class ZMachineClient extends EventEmitter {
    machine = null;
    screen = null;
    input = null;
    gamePath = '';

    lastError = null;

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

            this.screen = new DiscordScreen((text, status) =>
                this.sendOutput(text, status)
            );
            this.screen.onQuit = () => this.handleGameEnd();
            this.input = new DiscordInputProcessor(this.screen);

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
     * Called when the game itself ends (for example, the player quits in-game).
     */
    handleGameEnd() {
        this.machine = null;
        this.emit('end');
    }

    /**
     * Sends the game output to the channel, splitting into multiple messages if needed.
     * Discord has a 2000 character limit per message.
     *
     * @param {string} text - The text the game printed.
     * @param {string|null} status - The status line (V1-V3 games), if any.
     */
    sendOutput(text, status) {
        let final = status ? `-# ${status}\n${text}` : text;

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
     * Send the input message to the game.
     *
     * @param {string} message - The input message to be processed.
     * @return {boolean} False if the game is not waiting for input.
     */
    processInput(message) {
        if (!this.machine) {
            return false;
        }
        return this.input.submit(message);
    }

    /**
     * Stops the game and releases the interpreter.
     */
    stopGame() {
        if (this.machine) {
            this.input.cancelInput(this.machine);
            this.machine.quit();
            this.machine = null;
        }
    }

    /**
     * Save the game at the specified path.
     *
     * @param {string} savePath - The path where the game should be saved.
     */
    saveGame(savePath) {
        this.input.setNextFilename(savePath);
        this.input.submit('save');
    }

    /**
     * Restore the game from the specified path.
     *
     * @param {string} savePath - The path to the save file to be restored.
     */
    restoreGame(savePath) {
        this.input.setNextFilename(savePath);
        this.input.submit('restore');
    }
}

export const GameClient = new ZMachineClient();
