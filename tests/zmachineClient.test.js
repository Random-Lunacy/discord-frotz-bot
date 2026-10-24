import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

const gameFolder = path.resolve('games');

vi.mock('../sharedData.js', () => ({
    sharedData: {
        gameFolder: path.resolve('games'),
        channel: {
            send: vi.fn().mockResolvedValue({}),
        },
    },
}));

import { GameClient } from '../zmachineClient.js';
import { sharedData } from '../sharedData.js';

const hasZork = fs.existsSync(`${gameFolder}/zork-i.z3`);
const tick = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ZMachineClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameClient.removeAllListeners();
    });

    afterEach(() => {
        GameClient.stopGame();
    });

    describe('startGame', () => {
        it('should return false if game file does not exist', () => {
            const result = GameClient.startGame('nonexistent.z5');

            expect(result).toBe(false);
            expect(GameClient.lastError.message).toContain('does not exist');
        });

        it('should return false if the file is not a story file', () => {
            const bogus = `${gameFolder}/not-a-game.z5`;
            fs.writeFileSync(bogus, 'this is not a z-machine story file');
            try {
                expect(GameClient.startGame('not-a-game.z5')).toBe(false);
                expect(GameClient.lastError.message).toContain(
                    'Failed to start game'
                );
            } finally {
                fs.rmSync(bogus);
            }
        });
    });

    describe('processInput', () => {
        it('should return false when no game is running', () => {
            expect(GameClient.processInput('look')).toBe(false);
        });
    });

    describe.skipIf(!hasZork)('playing Zork I', () => {
        it('should send the opening text when the game starts', async () => {
            expect(GameClient.startGame('zork-i.z3')).toBe(true);
            await tick();

            const sent = sharedData.channel.send.mock.calls[0][0];
            expect(sent).toContain('ZORK I: The Great Underground Empire');
            expect(sent).toContain('West of House');
            expect(sent.trimEnd().endsWith('>')).toBe(false);
        });

        it('should respond to commands', async () => {
            GameClient.startGame('zork-i.z3');
            await tick();
            sharedData.channel.send.mockClear();

            expect(GameClient.processInput('open mailbox')).toBe(true);
            await tick();

            expect(sharedData.channel.send.mock.calls[0][0]).toContain(
                'Opening the small mailbox reveals a leaflet.'
            );
        });

        it('should emit end when the game quits', async () => {
            const onEnd = vi.fn();
            GameClient.on('end', onEnd);
            GameClient.startGame('zork-i.z3');
            await tick();

            GameClient.processInput('quit');
            await tick();
            GameClient.processInput('y');
            await tick();

            expect(onEnd).toHaveBeenCalled();
        });
    });
});
