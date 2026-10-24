import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const state = vi.hoisted(() => ({ gameFolder: '' }));
const mockSessions = { get: vi.fn() };
const mockLaunchGame = vi.fn();

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
        client: { users: { cache: new Map() } },
    },
}));
vi.mock('../../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../../launchGame.js', () => ({ launchGame: mockLaunchGame }));
vi.mock('discord.js', () => ({
    SlashCommandBuilder: vi.fn(),
    ActionRowBuilder: vi.fn(),
    StringSelectMenuBuilder: vi.fn(),
    StringSelectMenuOptionBuilder: vi.fn(),
    ComponentType: { StringSelect: 3 },
}));

const { invoke } = await import('../../../events/commands/restore.js');

describe('restore command used in a thread', () => {
    let session;
    let interaction;
    let game;

    const addSave = (name) => fs.writeFileSync(path.join(state.gameFolder, name), '');

    beforeEach(() => {
        vi.clearAllMocks();
        state.gameFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
        game = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };
        session = {
            game,
            channel: { id: 't1' },
            touch: vi.fn(),
            client: {
                whenReady: vi.fn().mockResolvedValue(true),
                restoreGame: vi.fn(),
            },
        };
        mockSessions.get.mockReturnValue(undefined);
        mockLaunchGame.mockResolvedValue({ session });
        interaction = {
            channel: { id: 't1', name: 'Zork I - Mitch', isThread: () => true },
            options: { getString: vi.fn().mockReturnValue(null) },
            deferReply: vi.fn(),
            editReply: vi.fn(),
        };
    });

    afterEach(() => {
        fs.rmSync(state.gameFolder, { recursive: true, force: true });
    });

    it('should restore the game the thread\'s saves are for, without asking which', async () => {
        addSave('sorcerer-t1-u1-100.qzl');
        addSave('zork1-t9-u1-300.qzl');

        await invoke(interaction);

        expect(mockLaunchGame).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({ id: 'sorcerer' }),
            expect.anything()
        );
    });

    it('should restore the newest save made in the thread before newer saves from elsewhere', async () => {
        addSave('zork1-t1-u1-100.qzl');
        addSave('zork1-t1-u2-200.qzl');
        addSave('zork1-t9-u1-900.qzl');

        await invoke(interaction);

        expect(session.client.restoreGame).toHaveBeenCalledWith(
            `${state.gameFolder}/zork1-t1-u2-200.qzl`
        );
    });

    it('should use the game named in the thread\'s name when it has no saves', async () => {
        addSave('zork1-t9-u1-900.qzl');

        await invoke(interaction);

        expect(mockLaunchGame).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({ id: 'zork1' }),
            expect.anything()
        );
        expect(session.client.restoreGame).toHaveBeenCalledWith(
            `${state.gameFolder}/zork1-t9-u1-900.qzl`
        );
    });

    it('should say when the thread\'s game has no saves', async () => {
        await invoke(interaction);

        expect(mockLaunchGame).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('No saved games found for "Zork I"'),
            })
        );
    });

    it('should let the game option override the thread', async () => {
        addSave('sorcerer-t1-u1-100.qzl');
        addSave('zork1-t9-u1-900.qzl');
        interaction.options.getString.mockReturnValue('zork1');

        await invoke(interaction);

        expect(mockLaunchGame).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({ id: 'zork1' }),
            expect.anything()
        );
    });
});
