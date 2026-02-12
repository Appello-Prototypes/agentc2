type SlackApiResponse<T> = {
    ok: boolean;
    error?: string;
} & T;

const SLACK_API_BASE = "https://slack.com/api";

const getSlackToken = () => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
        throw new Error("SLACK_BOT_TOKEN not configured");
    }
    return token;
};

/**
 * Call a Slack API endpoint.
 * Accepts an explicit botToken for multi-tenant support; falls back to env var.
 */
const callSlackApi = async <T>(
    endpoint: string,
    body: Record<string, unknown>,
    botToken?: string
) => {
    const token = botToken || getSlackToken();

    const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const data = (await response.json()) as SlackApiResponse<T>;
    if (!data.ok) {
        throw new Error(data.error || "Slack API error");
    }

    return data;
};

export const openDmChannel = async (userId: string, botToken?: string) => {
    const data = await callSlackApi<{ channel: { id: string } }>(
        "conversations.open",
        { users: userId },
        botToken
    );
    return data.channel.id;
};

export const sendSlackMessage = async (channelId: string, text: string, botToken?: string) => {
    await callSlackApi("chat.postMessage", { channel: channelId, text }, botToken);
};

export const sendSlackApprovalRequest = async (options: {
    userId: string;
    text: string;
    blocks?: Record<string, unknown>[];
    botToken?: string;
}) => {
    const channelId = await openDmChannel(options.userId, options.botToken);
    const response = await callSlackApi<{ ts: string }>(
        "chat.postMessage",
        {
            channel: channelId,
            text: options.text,
            ...(options.blocks ? { blocks: options.blocks } : {})
        },
        options.botToken
    );

    return { channelId, messageTs: response.ts };
};

export const sendSlackDM = async (userId: string, text: string, botToken?: string) => {
    const channelId = await openDmChannel(userId, botToken);
    await sendSlackMessage(channelId, text, botToken);
};
