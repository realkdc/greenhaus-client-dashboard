"use client";

import { useCallback, useMemo, useState } from "react";

type EnvironmentOption = "prod" | "staging" | "dev";

type RequestStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "success"; total: number; batches: number }
  | { state: "error"; message: string };

const DEFAULT_ENVIRONMENT: EnvironmentOption = "staging";

const environmentOptions: Array<{ label: string; value: EnvironmentOption }> = [
  { label: "Production", value: "prod" },
  { label: "Staging", value: "staging" },
  { label: "Development", value: "dev" },
];

type BroadcastResponse = {
  totalDevices: number;
  batchCount: number;
};

export default function PushCenter(): JSX.Element {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [jsonData, setJsonData] = useState("{\n  \"foo\": \"bar\"\n}");
  const [storeId, setStoreId] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentOption>(
    DEFAULT_ENVIRONMENT,
  );
  const [status, setStatus] = useState<RequestStatus>({ state: "idle" });

  // Resolve API base and admin key from build-time public env, fallback to relative API
  const apiBase = useMemo(() => {
    // Next.js exposes NEXT_PUBLIC_* vars via process.env at build time (client-safe prefix)
    if (typeof process !== "undefined") {
      return (
        process.env.NEXT_PUBLIC_VITE_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "/api"
      );
    }
    return "/api";
  }, []);
  const adminKey = useMemo(() => {
    if (typeof process !== "undefined") {
      return (
        process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY ||
        process.env.NEXT_PUBLIC_ADMIN_API_KEY ||
        ""
      );
    }
    return "";
  }, []);

  const validateJson = useCallback((raw: string): Record<string, unknown> => {
    try {
      const parsed = raw.trim() === "" ? {} : JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("JSON data must resolve to an object");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to parse JSON data";
      throw new Error(message);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!apiBase) {
        setStatus({
          state: "error",
          message: "Missing API base URL.",
        });
        return;
      }

      if (!adminKey) {
        setStatus({
          state: "error",
          message: "Missing VITE_ADMIN_API_KEY environment variable.",
        });
        return;
      }

      if (!title.trim()) {
        setStatus({
          state: "error",
          message: "Title is required.",
        });
        return;
      }

      if (!body.trim()) {
        setStatus({
          state: "error",
          message: "Body is required.",
        });
        return;
      }

      let parsedData: Record<string, unknown>;
      try {
        parsedData = validateJson(jsonData);
      } catch (error) {
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      setStatus({ state: "sending" });

      try {
        const response = await fetch(`${apiBase}/push/broadcast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            data: parsedData,
            segment: {
              env: environment,
              ...(storeId.trim() ? { storeId: storeId.trim() } : {}),
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Request failed with status ${response.status}`);
        }

        let payload: BroadcastResponse | null = null;
        try {
          payload = (await response.json()) as BroadcastResponse;
        } catch {
          payload = null;
        }

        setStatus({
          state: "success",
          total: payload?.totalDevices ?? 0,
          batches: payload?.batchCount ?? 0,
        });
      } catch (error) {
        setStatus({
          state: "error",
          message:
            error instanceof Error ? error.message : "Failed to send push notification.",
        });
      }
    },
    [
      adminKey,
      apiBase,
      body,
      environment,
      jsonData,
      storeId,
      title,
      validateJson,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Fresh produce drop"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="body">
          Body
        </label>
        <input
          id="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="New seasonal boxes available now!"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="jsonData">
          JSON Data
        </label>
        <textarea
          id="jsonData"
          value={jsonData}
          onChange={(event) => setJsonData(event.target.value)}
          rows={6}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-mono shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          spellCheck={false}
        />
        <p className="text-xs text-slate-500">
          Provide a JSON object that will be delivered as additional data.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="storeId">
          Store ID (optional)
        </label>
        <input
          id="storeId"
          value={storeId}
          onChange={(event) => setStoreId(event.target.value)}
          placeholder="store_123"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p className="text-xs text-slate-500">
          Leave blank to broadcast to the entire environment.
        </p>
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="environment"
        >
          Environment
        </label>
        <select
          id="environment"
          value={environment}
          onChange={(event) =>
            setEnvironment(event.target.value as EnvironmentOption)
          }
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {environmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          disabled={status.state === "sending"}
        >
          {status.state === "sending" ? "Sending…" : "Send push"}
        </button>

        <StatusMessage status={status} />
      </div>
    </form>
  );
}

function StatusMessage({ status }: { status: RequestStatus }) {
  if (status.state === "idle") {
    return (
      <span className="text-xs text-slate-400">
        Ready. Fill in the fields and press send.
      </span>
    );
  }

  if (status.state === "sending") {
    return <span className="text-sm font-medium text-slate-500">Sending…</span>;
  }

  if (status.state === "success") {
    return (
      <span className="text-sm font-medium text-emerald-600">
        Sent to {status.total} devices (batches: {status.batches})
      </span>
    );
  }

  if (status.state === "error") {
    return (
      <span className="text-sm font-medium text-red-600">
        Failed: {status.message}
      </span>
    );
  }

  return null;
}

// Note: Next.js inlines NEXT_PUBLIC_* at build time; no import.meta usage here to remain framework-agnostic

