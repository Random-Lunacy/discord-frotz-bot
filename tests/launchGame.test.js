import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = {
    get: vi.fn(),
    isFull: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    maxGames: 10,
};

vi.mock('../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('discord.js', () => ({
    ChannelType: { PublicThread: 11 },
}));

const { launchGame } = await import('../launchGame.js');

const game = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };

describe('launchGame', () => {
    let thread;
    let textChannel;
    let interaction;
    let session;

    beforeEach(() => {
        vi.clearAllMocks();
        session = {
            client: { startGame: vi.fn().mockReturnValue(true), lastError: new Error('nope') },
        };
        mockSessions.get.mockReturnValue(undefined);
        mockSessions.isFull.mockReturnValue(false);
        mockSessions.create.mockReturnValue(session);

        thread = {
            id: 'thread-1',
            isThread: () => true,
            members: { add: vi.fn().mockResolvedValue({}) },
            delete: vi.fn().mockResolvedValue({}),
        };
        textChannel = {
            id: 'text-1',
            isThread: () => false,
            threads: { create: vi.fn().mockResolvedValue(thread) },
        };
        interaction = {
            channel: textChannel,
            user: { id: 'u1', username: 'mitch' },
            member: { displayName: 'Mitch' },
        };
    });

    it('should make a thread for the game in a text channel', async () => {
        const result = await launchGame(interaction, game);

        expect(textChannel.threads.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Zork I - Mitch', type: 11 })
        );
        expect(thread.members.add).toHaveBeenCalledWith('u1');
        expect(mockSessions.create).toHaveBeenCalledWith({
            channel: thread,
            game,
            ownerId: 'u1',
        });
        expect(session.client.startGame).toHaveBeenCalledWith('zork-i.z3');
        expect(result).toEqual({ session });
    });

    it('should play in the thread when started inside one', async () => {
        interaction.channel = thread;

        const result = await launchGame(interaction, game);

        expect(textChannel.threads.create).not.toHaveBeenCalled();
        expect(mockSessions.create).toHaveBeenCalledWith(
            expect.objectContaining({ channel: thread })
        );
        expect(result.session).toBe(session);
    });

    it('should not start a second game in the same place', async () => {
        interaction.channel = thread;
        mockSessions.get.mockReturnValue({});

        const result = await launchGame(interaction, game);

        expect(result.error).toContain('already running here');
        expect(mockSessions.create).not.toHaveBeenCalled();
    });

    it('should refuse when the bot is at its game limit', async () => {
        mockSessions.isFull.mockReturnValue(true);

        const result = await launchGame(interaction, game);

        expect(result.error).toContain('maximum of 10 games');
        expect(textChannel.threads.create).not.toHaveBeenCalled();
    });

    it('should explain when a thread cannot be created', async () => {
        textChannel.threads.create.mockRejectedValue(new Error('Missing Permissions'));

        const result = await launchGame(interaction, game);

        expect(result.error).toContain('Create Public Threads');
        expect(mockSessions.create).not.toHaveBeenCalled();
    });

    it('should refuse channels that cannot have threads', async () => {
        interaction.channel = { id: 'dm-1', isThread: () => false };

        const result = await launchGame(interaction, game);

        expect(result.error).toContain('text channel or thread');
    });

    it('should clean up the session and thread when the game will not start', async () => {
        session.client.startGame.mockReturnValue(false);

        const result = await launchGame(interaction, game);

        expect(result.error).toBe('nope');
        expect(mockSessions.remove).toHaveBeenCalledWith('thread-1');
        expect(thread.delete).toHaveBeenCalled();
    });

    it('should leave a thread it did not create when the game will not start', async () => {
        interaction.channel = thread;
        session.client.startGame.mockReturnValue(false);

        await launchGame(interaction, game);

        expect(thread.delete).not.toHaveBeenCalled();
    });
});
