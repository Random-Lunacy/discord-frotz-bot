import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const gameFolder = path.resolve('games');

const state = vi.hoisted(() => ({ gameFolder: '' }));

vi.mock('../sharedData.js', () => ({
    sharedData: {
        get gameFolder() {
            return state.gameFolder;
        },
    },
}));

const channel = {
    id: '555',
    name: 'frotz-dev',
    send: vi.fn().mockResolvedValue({}),
};

import { ZMachineClient } from '../zmachineClient.js';

let GameClient;

const hasZork = fs.existsSync(`${gameFolder}/zork-i.z3`);
const message = (content, userId = 'u1') => ({
    content,
    author: { id: userId },
});
const sentText = () =>
    channel.send.mock.calls.map(([sent]) =>
        typeof sent === 'string' ? sent : sent.content
    );
const tick = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ZMachineClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameClient = new ZMachineClient({
            channel,
            gameId: 'zork1',
            gameName: 'Zork I',
        });
        state.gameFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'games-'));
        if (hasZork) {
            fs.copyFileSync(
                `${gameFolder}/zork-i.z3`,
                `${state.gameFolder}/zork-i.z3`
            );
        }
    });

    afterEach(() => {
        GameClient.stopGame();
        fs.rmSync(state.gameFolder, { recursive: true, force: true });
    });

    describe('startGame', () => {
        it('should return false if game file does not exist', () => {
            const result = GameClient.startGame('nonexistent.z5');

            expect(result).toBe(false);
            expect(GameClient.lastError.message).toContain('does not exist');
        });

        it('should return false if the file is not a story file', () => {
            const bogus = `${state.gameFolder}/not-a-game.z5`;
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

            const sent = channel.send.mock.calls[0][0];
            expect(sent).toContain('ZORK I: The Great Underground Empire');
            expect(sent).toContain('West of House');
            expect(sent.trimEnd().endsWith('>')).toBe(false);
        });

        it('should respond to commands', async () => {
            GameClient.startGame('zork-i.z3');
            await tick();
            channel.send.mockClear();

            expect(GameClient.processInput('open mailbox')).toBe(true);
            await tick();

            expect(channel.send.mock.calls[0][0]).toContain(
                'Opening the small mailbox reveals a leaflet.'
            );
        });

        it('should not announce the end when the game is force stopped', async () => {
            const onEnd = vi.fn();
            GameClient.on('end', onEnd);
            GameClient.startGame('zork-i.z3');
            await tick();
            channel.send.mockClear();

            GameClient.stopGame();
            await tick();

            expect(onEnd).not.toHaveBeenCalled();
            expect(sentText().join('\n')).not.toContain('has ended');
        });

        it('should run several games at once without them affecting each other', async () => {
            const otherChannel = {
                id: '777',
                send: vi.fn().mockResolvedValue({}),
            };
            const other = new ZMachineClient({
                channel: otherChannel,
                gameId: 'zork1',
                gameName: 'Zork I',
            });

            try {
                GameClient.startGame('zork-i.z3');
                other.startGame('zork-i.z3');
                await tick();
                channel.send.mockClear();
                otherChannel.send.mockClear();

                // The first game moves north; the second stays put and looks around
                GameClient.processInput('north');
                await tick();
                other.processInput('look');
                await tick();

                const first = channel.send.mock.calls.map(([m]) => m).join('\n');
                const second = otherChannel.send.mock.calls.map(([m]) => m).join('\n');
                expect(first).toContain('North of House');
                expect(second).toContain('West of House');
                expect(second).not.toContain('North of House');
            } finally {
                other.stopGame();
            }
        });

        describe('auto-saving', () => {
            beforeEach(async () => {
                GameClient.startGame('zork-i.z3');
                await tick();
                GameClient.processInput('north', 'u1');
                await tick();
                GameClient.processInput('east', 'u1');
                await tick();
                channel.send.mockClear();
            });

            it('should save quietly under a name marked autosave', async () => {
                const savePath = await GameClient.autoSave('u1');

                expect(savePath).toMatch(/\/zork1-555-u1-\d+-autosave\.qzl$/);
                expect(fs.existsSync(savePath)).toBe(true);
                // Nothing may be posted: the thread is archived
                expect(channel.send).not.toHaveBeenCalled();
                expect(GameClient.silent).toBe(false);
            });

            it('should save a game that can be restored', async () => {
                const savePath = await GameClient.autoSave('u1');
                GameClient.stopGame();

                const restored = new ZMachineClient({
                    channel,
                    gameId: 'zork1',
                    gameName: 'Zork I',
                });
                try {
                    restored.startGame('zork-i.z3');
                    await tick();
                    channel.send.mockClear();
                    restored.restoreGame(savePath);
                    await tick(300);
                    restored.processInput('look');
                    await tick();

                    expect(sentText().join('\n')).toContain('Behind House');
                } finally {
                    restored.stopGame();
                }
            });

            it('should be able to save while a question is waiting for a player', async () => {
                GameClient.processInput('save', 'u1');
                await tick();
                expect(GameClient.pendingPrompt).not.toBeNull();
                channel.send.mockClear();

                const savePath = await GameClient.autoSave('u1');

                expect(savePath).toMatch(/-autosave\.qzl$/);
                expect(channel.send).not.toHaveBeenCalled();
            });

            it('should have nothing to save once the game has stopped', async () => {
                GameClient.stopGame();

                expect(await GameClient.autoSave('u1')).toBeNull();
            });
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
            expect(sentText().join('\n')).toContain('has ended');
            expect(GameClient.processInput('look')).toBe(false);
        });

        describe('saving and restoring in the game', () => {
            const play = async (...commands) => {
                for (const command of commands) {
                    GameClient.handleMessage(message(command));
                    await tick();
                }
            };

            const savesOnDisk = () =>
                fs
                    .readdirSync(state.gameFolder)
                    .filter((file) => file.endsWith('.qzl'));

            beforeEach(async () => {
                GameClient.startGame('zork-i.z3');
                await tick();
                await play('open mailbox', 'north', 'east');
                channel.send.mockClear();
            });

            it('should save under a structured name using the label the saver gives', async () => {
                await play('save');
                expect(sentText().join('\n')).toContain('Name this save');

                await play('Before the Troll');

                const [file] = savesOnDisk();
                expect(savesOnDisk()).toHaveLength(1);
                expect(file).toMatch(
                    /^zork1-555-u1-\d+-before_the_troll\.qzl$/
                );
                expect(sentText().join('\n')).toContain('Saving as');
            });

            it('should use the default name when the player skips', async () => {
                await play('save', 'skip');

                expect(savesOnDisk()[0]).toMatch(
                    /^zork1-555-u1-\d+-player_\d{8}_\d{4}\.qzl$/
                );
            });

            it('should use the default name when the player does not reply', async () => {
                GameClient.promptTimeoutMs = 30;
                try {
                    await play('save');
                    await tick(200);
                } finally {
                    GameClient.promptTimeoutMs = 60_000;
                }

                expect(savesOnDisk()[0]).toMatch(
                    /^zork1-555-u1-\d+-player_\d{8}_\d{4}\.qzl$/
                );
                expect(sentText().join('\n')).toContain('No reply received');
            });

            it('should use DEFAULT_SAVE_NAME for the default name when it is set', async () => {
                process.env.DEFAULT_SAVE_NAME = '{game}_auto';
                try {
                    await play('save', 'skip');
                } finally {
                    delete process.env.DEFAULT_SAVE_NAME;
                }

                expect(savesOnDisk()[0]).toMatch(/-zork1_auto\.qzl$/);
            });

            it('should not save when the player cancels', async () => {
                await play('save', 'cancel');

                expect(savesOnDisk()).toHaveLength(0);
                expect(sentText().join('\n')).toContain('Save cancelled');
            });

            it('should only take the name from the player who typed save', async () => {
                await play('save');

                GameClient.handleMessage(message('hijacked', 'u2'));
                await tick();
                expect(savesOnDisk()).toHaveLength(0);

                GameClient.handleMessage(message('mine', 'u1'));
                await tick(200);
                expect(savesOnDisk()[0]).toMatch(/-mine\.qzl$/);
            });

            it('should offer this game\'s saves and restore the one chosen', async () => {
                await play('save', 'behind house');
                await play('west', 'inventory');
                channel.send.mockClear();

                await play('restore');
                const listing = sentText().join('\n');
                expect(listing).toContain('Which save do you want to restore?');
                expect(listing).toContain('"behind_house"');

                await play('1');
                await play('look');

                expect(sentText().join('\n')).toContain('Behind House');
            });

            it('should only take the restore choice from the player who typed restore', async () => {
                await play('save', 'skip');
                await play('west');
                channel.send.mockClear();

                await play('restore');
                GameClient.handleMessage(message('1', 'u2'));
                await tick(200);

                expect(sentText().join('\n')).not.toContain('Restore cancelled');
                GameClient.handleMessage(message('cancel', 'u1'));
                await tick();
                expect(sentText().join('\n')).toContain('Restore cancelled');
            });

            it('should say so when the game has no saves', async () => {
                await play('restore');

                expect(sentText().join('\n')).toContain(
                    'There are no saves for this game.'
                );
            });
        });
    });
});
