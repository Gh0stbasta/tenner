import { onlineManager, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineCacheProvider } from "./OfflineCacheProvider";
import { OFFLINE_CACHE_KEY, OFFLINE_CACHE_MAX_AGE_MS, type CacheStorage } from "./persistence";

function memoryStorage(): CacheStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function Dashboard({ load }: { readonly load: () => Promise<{ title: string }> }) {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: load });
  const analytics = useQuery({ queryKey: ["analytics", "summary"], queryFn: async () => ({ secret: "kpi" }) });
  return (
    <p>
      {query.data?.title ?? "lädt"} {analytics.data ? "analytics" : ""}
    </p>
  );
}

function renderCached(storage: CacheStorage, load: () => Promise<{ title: string }>, user = "STEFAN") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OfflineCacheProvider user={user} storage={storage} build="b1">
        <Dashboard load={load} />
      </OfflineCacheProvider>
    </QueryClientProvider>,
  );
}

async function fillCache(storage: ReturnType<typeof memoryStorage>) {
  renderCached(storage, async () => ({ title: "Bad putzen" }));
  await waitFor(() => expect(storage.data.get(OFFLINE_CACHE_KEY)).toContain("Bad putzen"));
}

describe("OfflineCacheProvider (MOBILE-003)", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  it("persists the dashboard but not analytics, versioned by build and user", async () => {
    const storage = memoryStorage();
    await fillCache(storage);
    await screen.findByText(/analytics/);
    const stored = storage.data.get(OFFLINE_CACHE_KEY) ?? "";
    expect(stored).toContain('"buster":"b1:STEFAN"');
    expect(stored).not.toContain("kpi");
  });

  it("shows the cached data offline without a request", async () => {
    const storage = memoryStorage();
    await fillCache(storage);
    document.body.innerHTML = "";
    onlineManager.setOnline(false);
    const load = vi.fn(async () => ({ title: "neu" }));
    renderCached(storage, load);
    expect(await screen.findByText(/Bad putzen/)).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it("discards the cache of another user", async () => {
    const storage = memoryStorage();
    await fillCache(storage);
    document.body.innerHTML = "";
    onlineManager.setOnline(false);
    renderCached(storage, async () => ({ title: "neu" }), "JULIA");
    await waitFor(() => expect(storage.data.has(OFFLINE_CACHE_KEY)).toBe(false));
    expect(screen.queryByText(/Bad putzen/)).not.toBeInTheDocument();
  });

  it("discards a cache older than 7 days", async () => {
    const storage = memoryStorage();
    await fillCache(storage);
    document.body.innerHTML = "";
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + OFFLINE_CACHE_MAX_AGE_MS + 60_000 });
    onlineManager.setOnline(false);
    renderCached(storage, async () => ({ title: "neu" }));
    await waitFor(() => expect(storage.data.has(OFFLINE_CACHE_KEY)).toBe(false));
    expect(screen.queryByText(/Bad putzen/)).not.toBeInTheDocument();
  });
});
