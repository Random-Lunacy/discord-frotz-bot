import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDenial = vi.fn();
const mockStart = { invoke: vi.fn() };
const mockSessions = { get: vi.fn() };
const mockKey = { handleKeyButton: vi.fn(), isKeyButton: vi.fn() };
const mockClient = vi.hoisted(() => ({ on: vi.fn(), user: { id: 'bot' } }));

vi.mock('../../sharedData.js', () => ({ sharedData: { client: mockClient } }));
vi.mock('../../sessions.js', () => ({ sessions: mockSessions }));
vi.mock('../../keyPrompt.js', () => mockKey);
vi.mock('../../logger.js', () => ({ Logger: { log: vi.fn() } }));
vi.mock('../../channelAccess.js', () => ({ channelDenial: mockDenial }));
vi.mock('discord.js', () => ({ MessageFlags: { Ephemeral: 64 } }));
vi.mock('#commands/start', () => mockStart);

const { invoke } = await import('../../events/interactionCreate.js');

// The handler that was registered for messages when the module loaded
const onMessage = mockClient.on.mock.calls.find(([event]) => event === 'messageCreate')[1];

describe('interactionCreate', () => {
    let interaction;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDenial.mockReturnValue(null);
        mockKey.isKeyButton.mockReturnValue(false);
        mockSessions.get.mockReturnValue(undefined);
        interaction = {
            commandName: 'start',
            isChatInputCommand: () => true,
            reply: vi.fn(),
        };
    });

    it('should run a command where it is allowed', async () => {
        await invoke(interaction);

        expect(mockStart.invoke).toHaveBeenCalledWith(interaction);
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should refuse a command in the wrong channel with a private reply, and not run it', async () => {
        mockDenial.mockReturnValue('Games can only be played in <#1>.');

        await invoke(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Games can only be played in <#1>.',
            flags: 64,
        });
        expect(mockStart.invoke).not.toHaveBeenCalled();
    });

    it('should press a key when the Continue button is clicked', async () => {
        interaction.isChatInputCommand = () => false;
        mockKey.isKeyButton.mockReturnValue(true);

        await invoke(interaction);

        expect(mockKey.handleKeyButton).toHaveBeenCalledWith(interaction);
        expect(mockStart.invoke).not.toHaveBeenCalled();
    });

    it('should ignore any other kind of interaction', async () => {
        interaction.isChatInputCommand = () => false;

        await invoke(interaction);

        expect(mockKey.handleKeyButton).not.toHaveBeenCalled();
        expect(mockStart.invoke).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

describe('messages in a channel', () => {
    let session;

    const message = (overrides = {}) => ({
        author: { id: 'player' },
        channel: { id: 't1' },
        content: 'look',
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        session = {
            paused: false,
            touch: vi.fn(),
            client: { handleMessage: vi.fn() },
        };
        mockSessions.get.mockReturnValue(session);
    });

    it('should send a message to the game in the thread it was sent in', () => {
        const sent = message();

        onMessage(sent);

        expect(mockSessions.get).toHaveBeenCalledWith('t1');
        expect(session.touch).toHaveBeenCalled();
        expect(session.client.handleMessage).toHaveBeenCalledWith(sent);
    });

    it('should ignore the bot\'s own messages', () => {
        onMessage(message({ author: { id: 'bot' } }));

        expect(session.client.handleMessage).not.toHaveBeenCalled();
        expect(session.touch).not.toHaveBeenCalled();
    });

    it('should ignore messages where there is no game', () => {
        mockSessions.get.mockReturnValue(undefined);

        expect(() => onMessage(message())).not.toThrow();
    });

    it('should ignore messages while the game is paused', () => {
        session.paused = true;

        onMessage(message());

        expect(session.client.handleMessage).not.toHaveBeenCalled();
        expect(session.touch).not.toHaveBeenCalled();
    });
});
