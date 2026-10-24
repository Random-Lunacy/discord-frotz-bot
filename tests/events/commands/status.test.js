import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = {
    get: vi.fn(),
    list: vi.fn(),
    size: 0,
    maxGames: 10,
};
const mockPermissions = { isAdmin: vi.fn() };
const embeds = [];

vi.mock('../../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../../permissions.js', () => mockPermissions);

vi.mock('discord.js', () => {
    return {
        EmbedBuilder: vi.fn().mockImplementation(function () {
            const embed = {
                fields: [],
                setTitle: vi.fn().mockReturnThis(),
                setColor: vi.fn().mockReturnThis(),
                addFields: vi.fn(function (fields) {
                    embed.fields.push(...fields);
                    return embed;
                }),
            };
            embeds.push(embed);
            return embed;
        }),
        SlashCommandBuilder: vi.fn(),
        MessageFlags: { Ephemeral: 64 },
    };
});

const { invoke } = await import('../../../events/commands/status.js');

const session = (overrides = {}) => ({
    channel: { id: 'thread-1' },
    game: { name: 'Zork I' },
    ownerId: 'owner-1',
    startedAt: Date.now() - 5 * 60_000,
    lastActivity: Date.now() - 60_000,
    paused: false,
    ...overrides,
});

describe('status command', () => {
    let interaction;
    let all;

    beforeEach(() => {
        embeds.length = 0;
        all = false;
        interaction = {
            channel: { id: 'thread-1' },
            options: { getBoolean: vi.fn(() => all) },
            reply: vi.fn(),
        };
        mockSessions.get.mockReturnValue(undefined);
        mockSessions.list.mockReturnValue([]);
        mockSessions.size = 0;
        mockPermissions.isAdmin.mockReturnValue(false);
    });

    it('should show admins the details of every game along with this channel', () => {
        mockPermissions.isAdmin.mockReturnValue(true);
        mockSessions.get.mockReturnValue(session());
        mockSessions.list.mockReturnValue([
            session(),
            session({ channel: { id: 'thread-2' }, game: { name: 'Sorcerer' } }),
        ]);

        invoke(interaction);

        const [here, list] = embeds[0].fields;
        expect(here.name).toBe('This channel');
        expect(list.name).toContain('(2 of 10)');
        expect(list.value).toContain('<#thread-2> **Sorcerer**');
    });

    it('should only show non-admins the count of games', () => {
        mockSessions.size = 3;
        mockSessions.list.mockReturnValue([session()]);

        invoke(interaction);

        const [, count] = embeds[0].fields;
        expect(count.value).toBe('3 of 10');
        expect(mockSessions.list).not.toHaveBeenCalled();
    });

    it('should describe the game in this channel', () => {
        mockSessions.get.mockReturnValue(session());
        mockSessions.size = 1;

        invoke(interaction);

        expect(mockSessions.get).toHaveBeenCalledWith('thread-1');
        const [field] = embeds[0].fields;
        expect(field.value).toContain('Zork I');
        expect(field.value).toContain('<@owner-1>');
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ flags: 64 })
        );
    });

    it('should say when there is no game in this channel', () => {
        invoke(interaction);

        expect(embeds[0].fields[0].value).toContain('No game is running here');
    });

    it('should not let non-admins list every game', () => {
        all = true;

        invoke(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Only server admins'),
            })
        );
        expect(mockSessions.list).not.toHaveBeenCalled();
    });

    it('should let admins list every game in progress', () => {
        all = true;
        mockPermissions.isAdmin.mockReturnValue(true);
        mockSessions.list.mockReturnValue([
            session(),
            session({
                channel: { id: 'thread-2' },
                game: { name: 'Sorcerer' },
                paused: true,
            }),
        ]);

        invoke(interaction);

        expect(embeds[0].fields).toHaveLength(1);
        const [field] = embeds[0].fields;
        expect(field.name).toContain('(2 of 10)');
        expect(field.value).toContain('<#thread-1> **Zork I**');
        expect(field.value).toContain('<#thread-2> **Sorcerer**');
        expect(field.value).toContain('paused');
    });

    it('should say when no games are running', () => {
        all = true;
        mockPermissions.isAdmin.mockReturnValue(true);

        invoke(interaction);

        expect(embeds[0].fields[0].value).toBe('No games are running.');
    });

    it('should keep a long list within the embed field limit', () => {
        all = true;
        mockPermissions.isAdmin.mockReturnValue(true);
        mockSessions.list.mockReturnValue(
            Array.from({ length: 40 }, (_, i) =>
                session({ channel: { id: `thread-${i}` } })
            )
        );

        invoke(interaction);

        const value = embeds[0].fields[0].value;
        expect(value.length).toBeLessThanOrEqual(1024);
        expect(value).toContain('…and more');
    });
});
