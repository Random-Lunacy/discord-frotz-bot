import { sharedData } from './sharedData.js';
import { } from 'dotenv/config';
import { Logger } from './logger.js';
import { StringDecoder } from 'string_decoder';
import { spawn } from 'child_process';
import fs from 'fs';

class FrotzClient {
    dFrotz = null;
    compiledOutput = '';
    gamePath = '';

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
            Logger.error(`Failed to launch Frotz: the game file ${gameFile} does not exist.`);
            this.lastError = new Error(`Failed to launch Frotz: the game file ${gameFile} does not exist.`);
            return false;
        }

        Logger.log(`Launching Frotz: ${this.gamePath}`);

        // Create Frotz child process for the game
        // -p   plain ASCII output only
        // -m   turn off MORE prompts
        // -R   restrict Frotz read/write to the specified folder
        this.dFrotz = spawn('dfrotz', ['-p', '-m', this.gamePath]);

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

        // Skip blank output
        if (_string.trim() === '') {
            return;
        }

        let output = this.cleanUpOutput(_string);

        this.compiledOutput += output;

        // this marks the end of input
        if (output.match(/(>\r)/)) {
            this.sendGameOutput();
        }
    }

    cleanUpOutput(raw) {
        let splitRaw = raw.split(/[\n]|[\r]/);
        let output = '';

        for (const element of splitRaw) {
            if (element.trim() === 'Using normal formatting.') {
                continue;
            }

            if (element.trim() === 'Loading ' + this.gamePath + '.') {
                continue;
            }

            if (output.length === 0 && element.trim() === '') {
                continue;
            }
            output += element.trim();
            output += '\r';
        }

        return output;
    }

    sendGameOutput() {
        let final = Buffer.from(this.compiledOutput, 'utf-8').toString();

        final = final.replace('\r', '\n');
        final = final.slice(0, final.length - 2).trim();

        final = '```\n' + this.cleanUpOutput(final, true) + '\n```';

        sharedData.channel.send(final);
        this.compiledOutput = '';
    }

    processInput(message) {
        this.dFrotz.stdin.write(message + '\n');
    }

    stopGame() {
        // cleanup the child process
        this.dFrotz.kill();
    }
}

export const Frotz = new FrotzClient();
