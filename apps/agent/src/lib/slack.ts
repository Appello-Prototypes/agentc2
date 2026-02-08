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

const callSlackApi = async <T>(endpoint: string, body: Record<string, unknown>) => {
    const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSlackToken()}`
        },
        body: JSON.stringify(body)
    });

    const data = (await response.json()) as SlackApiResponse<T>;
    if (!data.ok) {
        throw new Error(data.error || "Slack API error");
    }

    return data;
};

export const openDmChannel = async (userId: string) => {
    const data = await callSlackApi<{ channel: { id: string } }>("conversations.open", {
        users: userId
    });
    return data.channel.id;
};

export const sendSlackMessage = async (channelId: string, text: string) => {
    await callSlackApi("chat.postMessage", {
        channel: channelId,
        text
    });
};

export const sendSlackApprovalRequest = async (options: {
    userId: string;
    text: string;
    blocks?: Record<string, unknown>[];
}) => {
    const channelId = await openDmChannel(options.userId);
    const response = await callSlackApi<{ ts: string }>("chat.postMessage", {
        channel: channelId,
        text: options.text,
        ...(options.blocks ? { blocks: options.blocks } : {})
    });

    return { channelId, messageTs: response.ts };
};

export const sendSlackDM = async (userId: string, text: string) => {
    const channelId = await openDmChannel(userId);
    await sendSlackMessage(channelId, text);
};
