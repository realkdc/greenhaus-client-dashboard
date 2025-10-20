const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";

export type ExpoTicket = {
  id?: string;
  status: string;
  message?: string;
  details?: Record<string, unknown> & { error?: string };
};

export type ExpoReceipt = {
  status: string;
  message?: string;
  details?: { error?: string };
};

type ExpoSendResponse = {
  data?: ExpoTicket[];
  errors?: unknown;
};

type ExpoReceiptsResponse = {
  data?: Record<string, ExpoReceipt>;
  errors?: unknown;
};

export async function sendExpoMessages(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<ExpoTicket[]> {
  if (tokens.length === 0) {
    return [];
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: "default",
      })),
    ),
  });

  const result = (await response.json()) as ExpoSendResponse;
  return result.data ?? [];
}

export async function getExpoReceipts(ticketIds: string[]): Promise<Record<string, ExpoReceipt>> {
  if (ticketIds.length === 0) {
    return {};
  }

  const response = await fetch(EXPO_RECEIPTS_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ids: ticketIds }),
  });

  const result = (await response.json()) as ExpoReceiptsResponse;
  return result.data ?? {};
}


