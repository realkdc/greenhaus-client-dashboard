const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export type ExpoMessagePayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type ExpoPushResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

export function isExpoPushToken(token: string | null | undefined): token is string {
  if (typeof token !== "string") {
    return false;
  }

  return /^Exponent?Push?Token\[[A-Za-z0-9+\/_-]+\]$/.test(token.trim());
}

export function chunkTokens(tokens: string[], size = 100): string[][] {
  const chunks: string[][] = [];
  let pointer = 0;

  while (pointer < tokens.length) {
    chunks.push(tokens.slice(pointer, pointer + size));
    pointer += size;
  }

  return chunks;
}

export async function sendExpoPushNotifications(
  tokens: string[],
  message: ExpoMessagePayload,
): Promise<ExpoPushResult[]> {
  const chunks = chunkTokens(tokens, 100);
  const results: ExpoPushResult[] = [];

  for (const chunk of chunks) {
    const body = chunk.map((token) => ({
      to: token,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: "default",
    }));

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    results.push({
      status: response.status,
      ok: response.ok,
      body: payload,
    });
  }

  return results;
}

