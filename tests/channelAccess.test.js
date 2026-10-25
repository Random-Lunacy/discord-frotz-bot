import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSessions = { get: vi.fn() };
const mockPermissions = { isAdmin: vi.fn() };

vi.mock('../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../permissions.js', () => mockPermissions);

const { channelDenial, channelRestrictions, isAllowedHere } = await import('../channelAccess.js');

const GAMES = '1158820946925338686';
const OTHER = '1158820946925338999';
const THREAD = '1563772643449110670';

const interaction = (channelId, options = {}) => ({
    channelId,
    commandName: 'start',
    channel: {
        id: channelId,
        isThread: () => Boolean(options.parentId),
        parentId: options.parentId,
    },
    ...options.extra,
});

describe('channelRestrictions', () => {
    afterEach(() => {
        delete process.env.ALLOWED_CHANNELS;
    });

    it('should not restrict anything when the setting is empty or missing', () => {
        expect(channelRestrictions()).toEqual({ restricted: false, ids: [], invalid: [] });

        process.env.ALLOWED_CHANNELS = '  ,  ';
        expect(channelRestrictions().restricted).toBe(false);
    });

    it('should read IDs separated by commas, spaces or both', () => {
        process.env.ALLOWED_CHANNELS = `${GAMES}, ${OTHER}  ${THREAD}`;

        expect(channelRestrictions()).toEqual({
            restricted: true,
            ids: [GAMES, OTHER, THREAD],
            invalid: [],
        });
    });

    it('should report entries that are not channel IDs', () => {
        process.env.ALLOWED_CHANNELS = `${GAMES},#frotz-dev,123`;

        expect(channelRestrictions()).toEqual({
            restricted: true,
            ids: [GAMES],
            invalid: ['#frotz-dev', '123'],
        });
    });

    it('should stay restricted when none of the entries are valid', () => {
        process.env.ALLOWED_CHANNELS = '#frotz-dev';

        expect(channelRestrictions()).toEqual({
            restricted: true,
            ids: [],
            invalid: ['#frotz-dev'],
        });
    });
});

describe('isAllowedHere', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.get.mockReturnValue(undefined);
        process.env.ALLOWED_CHANNELS = GAMES;
    });

    afterEach(() => {
        delete process.env.ALLOWED_CHANNELS;
    });

    it('should allow everywhere when no channels are set', () => {
        delete process.env.ALLOWED_CHANNELS;

        expect(isAllowedHere(interaction(OTHER))).toBe(true);
    });

    it('should allow a listed channel', () => {
        expect(isAllowedHere(interaction(GAMES))).toBe(true);
    });

    it('should refuse a channel that is not listed', () => {
        expect(isAllowedHere(interaction(OTHER))).toBe(false);
    });

    it('should allow a thread under a listed channel', () => {
        expect(isAllowedHere(interaction(THREAD, { parentId: GAMES }))).toBe(true);
    });

    it('should refuse a thread under a channel that is not listed', () => {
        expect(isAllowedHere(interaction(THREAD, { parentId: OTHER }))).toBe(false);
    });

    it('should allow a listed thread itself', () => {
        process.env.ALLOWED_CHANNELS = THREAD;

        expect(isAllowedHere(interaction(THREAD, { parentId: OTHER }))).toBe(true);
    });

    it('should keep working in a thread that already has a game, even if its channel is no longer listed', () => {
        mockSessions.get.mockReturnValue({ game: { name: 'Zork I' } });

        expect(isAllowedHere(interaction(THREAD, { parentId: OTHER }))).toBe(true);
        expect(mockSessions.get).toHaveBeenCalledWith(THREAD);
    });

    it('should refuse a direct message', () => {
        const dm = { channelId: 'dm-1', channel: null, commandName: 'start' };

        expect(isAllowedHere(dm)).toBe(false);
    });
});

describe('channelDenial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSessions.get.mockReturnValue(undefined);
        mockPermissions.isAdmin.mockReturnValue(false);
        process.env.ALLOWED_CHANNELS = GAMES;
    });

    afterEach(() => {
        delete process.env.ALLOWED_CHANNELS;
    });

    it('should return nothing where commands are allowed', () => {
        expect(channelDenial(interaction(GAMES))).toBeNull();
    });

    it('should name the allowed channel when refusing', () => {
        const message = channelDenial(interaction(OTHER));

        expect(message).toBe(`Games can only be played in <#${GAMES}>, or in a thread in it.`);
    });

    it('should name every allowed channel when there are several', () => {
        process.env.ALLOWED_CHANNELS = `${GAMES},${THREAD}`;

        expect(channelDenial(interaction(OTHER))).toBe(
            `Games can only be played in <#${GAMES}>, <#${THREAD}>, or in a thread in one of them.`
        );
    });

    it('should let an admin use /status anywhere, because the reply is only shown to them', () => {
        mockPermissions.isAdmin.mockReturnValue(true);

        expect(channelDenial({ ...interaction(OTHER), commandName: 'status' })).toBeNull();
    });

    it('should not let an admin use other commands anywhere', () => {
        mockPermissions.isAdmin.mockReturnValue(true);

        expect(channelDenial({ ...interaction(OTHER), commandName: 'start' })).not.toBeNull();
        expect(channelDenial({ ...interaction(OTHER), commandName: 'restore' })).not.toBeNull();
    });

    it('should not let a non-admin use /status anywhere', () => {
        expect(channelDenial({ ...interaction(OTHER), commandName: 'status' })).not.toBeNull();
    });

    it('should say the setting is wrong when it has no valid channels', () => {
        process.env.ALLOWED_CHANNELS = '#frotz-dev';

        expect(channelDenial(interaction(GAMES))).toContain('none of them are valid');
    });
});
