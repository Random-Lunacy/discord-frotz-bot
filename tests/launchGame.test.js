import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const { launchGame, threadLifetimeMinutes } = await import('../launchGame.js');

const game = { id: 'zork1', name: 'Zork I', file: 'zork-i.z3' };

describe('threadLifetimeMinutes', () => {
    afterEach(() => {
        delete process.env.THREAD_LIFETIME_DAYS;
    });

    it('should default to 7 days', () => {
        expect(threadLifetimeMinutes()).toBe(10080);
    });

    it.each([
        ['1', 1440],
        ['3', 4320],
        ['7', 10080],
    ])('should give %s days as %i minutes', (days, minutes) => {
        process.env.THREAD_LIFETIME_DAYS = days;

        expect(threadLifetimeMinutes()).toBe(minutes);
    });

    it.each(['2', '14', '0', 'week', ''])(
        'should fall back to 7 days for %j',
        (days) => {
            process.env.THREAD_LIFETIME_DAYS = days;

            expect(threadLifetimeMinutes()).toBe(10080);
        }
    );
});

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

    it('should close the thread after the configured lifetime', async () => {
        process.env.THREAD_LIFETIME_DAYS = '3';
        try {
            await launchGame(interaction, game);
        } finally {
            delete process.env.THREAD_LIFETIME_DAYS;
        }

        expect(textChannel.threads.create).toHaveBeenCalledWith(
            expect.objectContaining({ autoArchiveDuration: 4320 })
        );
    });

    describe('reusing a thread', () => {
        let saved;

        beforeEach(() => {
            saved = {
                id: 'saved-thread',
                parentId: 'text-1',
                archived: false,
                isThread: () => true,
                members: { add: vi.fn().mockResolvedValue({}) },
                setArchived: vi.fn().mockResolvedValue({}),
                delete: vi.fn(),
            };
            interaction.guild = {
                channels: { fetch: vi.fn().mockResolvedValue(saved) },
            };
            textChannel.threads.fetchActive = vi.fn().mockResolvedValue({
                threads: { find: () => undefined },
            });
        });

        it('should play in the thread the save was made in', async () => {
            const result = await launchGame(interaction, game, {
                reuse: true,
                threadId: 'saved-thread',
            });

            expect(interaction.guild.channels.fetch).toHaveBeenCalledWith('saved-thread');
            expect(textChannel.threads.create).not.toHaveBeenCalled();
            expect(mockSessions.create).toHaveBeenCalledWith(
                expect.objectContaining({ channel: saved })
            );
            expect(saved.members.add).toHaveBeenCalledWith('u1');
            expect(result.session).toBe(session);
        });

        it('should reopen the thread if it was archived', async () => {
            saved.archived = true;

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(saved.setArchived).toHaveBeenCalledWith(false);
            expect(textChannel.threads.create).not.toHaveBeenCalled();
        });

        it('should make a new thread if the archived one cannot be reopened', async () => {
            saved.archived = true;
            saved.setArchived.mockRejectedValue(new Error('locked'));

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(textChannel.threads.create).toHaveBeenCalled();
        });

        it('should make a new thread if the saved one is gone', async () => {
            interaction.guild.channels.fetch.mockRejectedValue(new Error('Unknown Channel'));

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(textChannel.threads.create).toHaveBeenCalled();
        });

        it('should not reuse a thread from another channel', async () => {
            saved.parentId = 'other-channel';

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(textChannel.threads.create).toHaveBeenCalled();
        });

        it('should not reuse a thread that already has a game', async () => {
            mockSessions.get.mockImplementation((id) =>
                id === 'saved-thread' ? {} : undefined
            );

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(textChannel.threads.create).toHaveBeenCalled();
        });

        it('should fall back to an open thread named for the game and player', async () => {
            const named = { ...saved, id: 'named-thread', name: 'Zork I - Mitch' };
            textChannel.threads.fetchActive.mockResolvedValue({
                threads: { find: (fn) => (fn(named) ? named : undefined) },
            });

            await launchGame(interaction, game, { reuse: true });

            expect(interaction.guild.channels.fetch).not.toHaveBeenCalled();
            expect(mockSessions.create).toHaveBeenCalledWith(
                expect.objectContaining({ channel: named })
            );
            expect(textChannel.threads.create).not.toHaveBeenCalled();
        });

        it('should not look for a thread to reuse unless asked to', async () => {
            await launchGame(interaction, game);

            expect(interaction.guild.channels.fetch).not.toHaveBeenCalled();
            expect(textChannel.threads.create).toHaveBeenCalled();
        });

        it('should keep a reused thread when the game will not start', async () => {
            session.client.startGame.mockReturnValue(false);

            await launchGame(interaction, game, { reuse: true, threadId: 'saved-thread' });

            expect(saved.delete).not.toHaveBeenCalled();
        });
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
