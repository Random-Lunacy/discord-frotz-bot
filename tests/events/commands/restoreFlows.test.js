import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The /restore command end to end: every way a restore can go, driven the way Discord drives it
// (an interaction, a select menu whose collector reports a choice, a timeout).

const state = vi.hoisted(() => ({ gameFolder: '' }));
const mockSessions = { get: vi.fn() };
const mockLaunchGame = vi.fn();
const log = vi.fn();
const users = new Map();

vi.mock('../../../sharedData.js', () => ({
    sharedData: {
        get gameFolder() {
            return state.gameFolder;
        },
        gameList: {
            games: [
                { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' },
                { id: 'sorcerer', name: 'Sorcerer', file: 'sorcerer.z3' },
            ],
        },
        client: { users: { cache: users } },
    },
}));
vi.mock('../../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../../launchGame.js', () => ({ launchGame: mockLaunchGame }));
vi.mock('../../../logger.js', () => ({ Logger: { log } }));

// Builders that remember what they were given, so a test can read the menu back
vi.mock('discord.js', () => {
    class StringSelectMenuBuilder {
        constructor() {
            this.data = { options: [] };
        }
        setCustomId(id) {
            this.data.customId = id;
            return this;
        }
        setPlaceholder(text) {
            this.data.placeholder = text;
            return this;
        }
        addOptions(...options) {
            this.data.options.push(...options.flat());
            return this;
        }
    }
    class StringSelectMenuOptionBuilder {
        constructor() {
            this.data = {};
        }
        setLabel(label) {
            this.data.label = label;
            return this;
        }
        setDescription(description) {
            this.data.description = description;
            return this;
        }
        setValue(value) {
            this.data.value = value;
            return this;
        }
    }
    class ActionRowBuilder {
        constructor() {
            this.components = [];
        }
        addComponents(...components) {
            this.components.push(...components);
            return this;
        }
    }
    return {
        StringSelectMenuBuilder,
        StringSelectMenuOptionBuilder,
        ActionRowBuilder,
        SlashCommandBuilder: vi.fn(),
        ComponentType: { StringSelect: 3 },
    };
});

const { invoke } = await import('../../../events/commands/restore.js');

const ZORK = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };

describe('/restore flows', () => {
    let interaction;
    let handlers;
    let collector;
    let response;
    let session;

    const addSave = (name) => fs.writeFileSync(path.join(state.gameFolder, name), '');
    const savePath = (name) => `${state.gameFolder}/${name}`;

    /** The select menu the command last put in a reply. */
    const menu = () => {
        const reply = interaction.editReply.mock.calls.map(([call]) => call).find((call) => call.components?.length);
        return reply?.components[0].components[0].data;
    };
    const choose = (value) =>
        handlers.collect({ deferUpdate: vi.fn().mockResolvedValue(undefined), values: [value] });
    const replies = () => interaction.editReply.mock.calls.map(([call]) => call.content);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        users.clear();
        state.gameFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-flows-'));

        handlers = {};
        collector = {
            on: vi.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };
        response = { createMessageComponentCollector: vi.fn(() => collector) };
        session = {
            game: ZORK,
            channel: { id: 't1' },
            touch: vi.fn(),
            client: {
                whenReady: vi.fn().mockResolvedValue(true),
                restoreGame: vi.fn().mockResolvedValue(true),
            },
        };
        interaction = {
            channel: { id: 't1', name: 'Zork I - Mitch', isThread: () => false },
            options: { getString: vi.fn().mockReturnValue(null) },
            deferReply: vi.fn().mockResolvedValue(undefined),
            editReply: vi.fn().mockResolvedValue(response),
        };
        mockSessions.get.mockReturnValue(undefined);
        mockLaunchGame.mockResolvedValue({ session });
    });

    afterEach(() => {
        vi.useRealTimers();
        fs.rmSync(state.gameFolder, { recursive: true, force: true });
    });

    describe('in a thread with a game running', () => {
        beforeEach(() => {
            mockSessions.get.mockReturnValue(session);
        });

        it('should say when the game has no saves', async () => {
            await invoke(interaction);

            expect(replies()).toEqual(['No saved games found for Zork I.']);
        });

        it('should offer the game\'s saves, newest from this thread first, with Cancel last', async () => {
            addSave('zork1-t9-u1-900-elsewhere.qzl');
            addSave('zork1-t1-u1-100-here_old.qzl');
            addSave('zork1-t1-u2-200-here_new.qzl');
            addSave('sorcerer-t1-u1-300.qzl');
            users.set('u2', { globalName: 'Kama' });

            await invoke(interaction);

            const options = menu().options.map((option) => option.data);
            expect(menu().customId).toBe('save-select');
            expect(options.map((option) => option.value)).toEqual([
                savePath('zork1-t1-u2-200-here_new.qzl'),
                savePath('zork1-t1-u1-100-here_old.qzl'),
                savePath('zork1-t9-u1-900-elsewhere.qzl'),
                'cancel',
            ]);
            expect(options[0].label).toContain('here_new - Kama');
            expect(options[1].label).toContain('here_old - u1');
        });

        it('should offer at most 24 saves, leaving room for Cancel', async () => {
            for (let i = 1; i <= 30; i++) {
                addSave(`zork1-t1-u1-${1000 + i}.qzl`);
            }

            await invoke(interaction);

            expect(menu().options).toHaveLength(25);
            expect(menu().options.at(-1).data.value).toBe('cancel');
        });

        it('should restore the save that is chosen', async () => {
            addSave('zork1-t1-u1-1700000000-start.qzl');
            await invoke(interaction);

            await choose(savePath('zork1-t1-u1-1700000000-start.qzl'));

            expect(session.touch).toHaveBeenCalled();
            expect(session.client.restoreGame).toHaveBeenCalledWith(
                savePath('zork1-t1-u1-1700000000-start.qzl')
            );
            expect(replies().at(-1)).toBe('Restoring Zork I from "start" <t:1700000000:f>.');
        });

        it('should cancel when Cancel is chosen', async () => {
            addSave('zork1-t1-u1-100.qzl');
            await invoke(interaction);

            await choose('cancel');

            expect(session.client.restoreGame).not.toHaveBeenCalled();
            expect(replies().at(-1)).toBe('Restore cancelled.');
        });

        it('should say so when the game is not ready to restore', async () => {
            addSave('zork1-t1-u1-100.qzl');
            session.client.restoreGame.mockResolvedValue(false);
            await invoke(interaction);

            await choose(savePath('zork1-t1-u1-100.qzl'));

            expect(replies().at(-1)).toContain('not ready to restore');
        });

        it('should report an error rather than leave the command hanging', async () => {
            addSave('zork1-t1-u1-100.qzl');
            session.client.restoreGame.mockRejectedValue(new Error('boom'));
            await invoke(interaction);

            await choose(savePath('zork1-t1-u1-100.qzl'));

            expect(replies().at(-1)).toContain('An error occurred while restoring the save: boom');
            expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
        });

        it('should log if even the error reply fails', async () => {
            addSave('zork1-t1-u1-100.qzl');
            session.client.restoreGame.mockRejectedValue(new Error('boom'));
            await invoke(interaction);
            interaction.editReply.mockRejectedValue(new Error('interaction expired'));

            await choose(savePath('zork1-t1-u1-100.qzl'));

            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('Error responding to interaction') })
            );
        });

        it('should time out if nothing is chosen', async () => {
            addSave('zork1-t1-u1-100.qzl');
            await invoke(interaction);

            await handlers.end({ size: 0 }, 'time');

            expect(replies().at(-1)).toContain('timed out after 1 minute');
        });

        it('should not report a timeout when a choice was made', async () => {
            addSave('zork1-t1-u1-100.qzl');
            await invoke(interaction);
            const before = interaction.editReply.mock.calls.length;

            await handlers.end({ size: 1 }, 'time');
            await handlers.end({ size: 0 }, 'limit');

            expect(interaction.editReply.mock.calls.length).toBe(before);
        });

        it('should log if the timeout reply fails', async () => {
            addSave('zork1-t1-u1-100.qzl');
            await invoke(interaction);
            interaction.editReply.mockRejectedValue(new Error('gone'));

            await handlers.end({ size: 0 }, 'time');

            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('timed out interaction') })
            );
        });

        it('should ignore a game option, say so, then still offer the saves', async () => {
            vi.useFakeTimers();
            addSave('zork1-t1-u1-100.qzl');
            interaction.options.getString.mockReturnValue('sorcerer');

            await invoke(interaction);
            expect(replies()).toEqual([expect.stringContaining('game parameter is ignored')]);

            await vi.advanceTimersByTimeAsync(2000);

            expect(menu().customId).toBe('save-select');
        });
    });

    describe('with no game running and a game named', () => {
        beforeEach(() => {
            interaction.options.getString.mockReturnValue('zork1');
        });

        it('should reject a game it does not know', async () => {
            interaction.options.getString.mockReturnValue('nope');

            await invoke(interaction);

            expect(replies()).toEqual(['Could not find game with ID "nope".']);
            expect(mockLaunchGame).not.toHaveBeenCalled();
        });

        it('should say when the game has no saves, and not start it', async () => {
            await invoke(interaction);

            expect(replies()).toEqual(['No saved games found for "Zork I". Use /start to start a new game.']);
            expect(mockLaunchGame).not.toHaveBeenCalled();
        });

        it('should start the game and restore its newest save', async () => {
            addSave('zork1-t9-u1-100.qzl');
            addSave('zork1-t9-u1-300.qzl');

            await invoke(interaction);

            expect(mockLaunchGame).toHaveBeenCalledWith(interaction, ZORK, {
                reuse: true,
                threadId: 't9',
            });
            expect(session.client.restoreGame).toHaveBeenCalledWith(savePath('zork1-t9-u1-300.qzl'));
            expect(replies()).toContain('Starting Zork I in <#t1>...');
            expect(replies().at(-1)).toContain('Restoring Zork I from <t:300:f>');
        });

        it('should prefer a save made in this channel to a newer one made elsewhere', async () => {
            addSave('zork1-t1-u1-100-mine.qzl');
            addSave('zork1-t9-u1-900-newer_elsewhere.qzl');

            await invoke(interaction);

            expect(session.client.restoreGame).toHaveBeenCalledWith(
                savePath('zork1-t1-u1-100-mine.qzl')
            );
        });

        it('should say why the game could not be started', async () => {
            addSave('zork1-t9-u1-100.qzl');
            mockLaunchGame.mockResolvedValue({ error: 'The bot is already running its maximum of 10 games.' });

            await invoke(interaction);

            expect(replies().at(-1)).toBe('The bot is already running its maximum of 10 games.');
            expect(session.client.restoreGame).not.toHaveBeenCalled();
        });

        it('should report an error if starting the game throws', async () => {
            addSave('zork1-t9-u1-100.qzl');
            mockLaunchGame.mockRejectedValue(new Error('no permission'));

            await invoke(interaction);

            expect(replies().at(-1)).toContain('An error occurred while starting the game: no permission');
            expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
        });

        it('should report an error if the new game never becomes ready', async () => {
            addSave('zork1-t9-u1-100.qzl');
            session.client.whenReady.mockResolvedValue(false);

            await invoke(interaction);

            expect(replies().at(-1)).toContain('the game did not become ready');
        });

        it('should report an error if the game will not take the restore', async () => {
            addSave('zork1-t9-u1-100.qzl');
            session.client.restoreGame.mockResolvedValue(false);

            await invoke(interaction);

            expect(replies().at(-1)).toContain('An error occurred while restoring the save');
        });
    });

    describe('in a thread with no game running', () => {
        beforeEach(() => {
            interaction.channel = { id: 't1', name: 'Sorcerer - Mitch', isThread: () => true };
        });

        it('should restore the game the thread\'s own save was for', async () => {
            addSave('sorcerer-t1-u1-100.qzl');
            addSave('zork1-t9-u1-900.qzl');

            await invoke(interaction);

            expect(mockLaunchGame).toHaveBeenCalledWith(
                interaction,
                expect.objectContaining({ id: 'sorcerer' }),
                expect.objectContaining({ reuse: true })
            );
        });
    });

    describe('with no game running and none named', () => {
        it('should say when no game has any saves', async () => {
            await invoke(interaction);

            expect(replies()).toEqual(['No saved games found for any game. Use `/start` to start a new game.']);
            expect(response.createMessageComponentCollector).not.toHaveBeenCalled();
        });

        it('should offer the games that have saves, with Cancel last', async () => {
            addSave('zork1-t9-u1-100.qzl');

            await invoke(interaction);

            const options = menu().options.map((option) => option.data);
            expect(menu().customId).toBe('game-select');
            expect(options.map((option) => option.value)).toEqual(['zork1', 'cancel']);
            expect(options[0].label).toBe('Zork I');
        });

        it('should start the game that is chosen and restore its newest save', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);

            await choose('zork1');

            expect(mockLaunchGame).toHaveBeenCalled();
            expect(session.client.restoreGame).toHaveBeenCalledWith(savePath('zork1-t9-u1-100.qzl'));
        });

        it('should cancel when Cancel is chosen', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);

            await choose('cancel');

            expect(mockLaunchGame).not.toHaveBeenCalled();
            expect(replies().at(-1)).toBe('Restore operation cancelled.');
        });

        it('should say so if the save has gone by the time the game starts', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);
            fs.rmSync(savePath('zork1-t9-u1-100.qzl'));

            await choose('zork1');

            expect(replies().at(-1)).toBe('Started Zork I, but couldn\'t find a save file to restore.');
        });

        it('should report an error if starting the chosen game throws', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);
            mockLaunchGame.mockRejectedValue(new Error('no permission'));

            await choose('zork1');

            expect(replies().at(-1)).toContain('An error occurred while starting the game: no permission');
        });

        it('should report an error if the choice cannot be handled at all', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);

            await handlers.collect({
                deferUpdate: vi.fn().mockRejectedValue(new Error('interaction expired')),
                values: ['zork1'],
            });

            expect(replies().at(-1)).toContain('An error occurred while processing your selection');
            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('Error in collector handler') })
            );
        });

        it('should log if even that error reply fails', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);
            interaction.editReply.mockRejectedValue(new Error('gone'));

            await handlers.collect({
                deferUpdate: vi.fn().mockRejectedValue(new Error('interaction expired')),
                values: ['zork1'],
            });

            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('Error responding to interaction') })
            );
        });

        it('should not report a timeout when a game was chosen', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);
            const before = interaction.editReply.mock.calls.length;

            await handlers.end({ size: 1 }, 'time');

            expect(interaction.editReply.mock.calls.length).toBe(before);
        });

        it('should time out if nothing is chosen', async () => {
            addSave('zork1-t9-u1-100.qzl');
            await invoke(interaction);

            await handlers.end({ size: 0 }, 'time');

            expect(replies().at(-1)).toContain('timed out after 1 minute');
        });
    });
});
