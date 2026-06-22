"use client";

import { useEffect, useState } from "react";
import type { ApiResponse, TrendingHashtag, RefreshResult } from "@/types";

type TrendingApiBody = ApiResponse<TrendingHashtag[]> & { lastRefreshedAt?: string | null };

export function TiktokTrendingPanel() {
  const [items, setItems] = useState<TrendingHashtag[]>([]);
  const [isMock, setIsMock] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadTrending() {
    setLoading(true);
    try {
      const res = await fetch("/api/tiktok/trending?limit=10");
      const json: TrendingApiBody = await res.json();
      if (json.ok) {
        setItems(json.data);
        setIsMock(json.mock);
        setLastRefreshedAt(json.lastRefreshedAt ?? null);
      }
    } catch {
      // Read endpoint is already fallback-safe server-side; a network
      // failure here just means "show stale state, let user retry".
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrending();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/tiktok/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "trending" }),
      });
      const json: ApiResponse<RefreshResult> = await res.json();

      if (!json.ok) {
        setNotice(json.error);
      } else if (json.data.status === "success") {
        setNotice(`Refreshed — pulled ${json.data.itemsFetched} hashtags from Apify.`);
        await loadTrending();
      } else if (json.data.status === "mock_fallback") {
        setNotice("Apify call didn't return fresh data — still showing cached/mock results.");
      } else {
        setNotice("Refresh failed — showing existing cached data.");
      }
    } catch {
      setNotice("Network error while refreshing. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>TikTok trending hashtags</h2>
        <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "6px 12px" }}>
          {refreshing ? "Refreshing…" : "Refresh from Apify"}
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#666", margin: "4px 0 12px" }}>
        {isMock ? (
          <em>Showing mock data — click refresh to pull live data from Apify.</em>
        ) : (
          <>Last refreshed: {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleString() : "unknown"}</>
        )}
      </p>

      {notice && (
        <p style={{ background: "#fff3cd", padding: 8, borderRadius: 6, fontSize: 13 }}>{notice}</p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <ol style={{ paddingLeft: 20 }}>
          {items.map((h) => (
            <li key={h.hashtag} style={{ marginBottom: 4 }}>
              <strong>#{h.hashtag}</strong>
              {h.viewCount !== null && <> — {h.viewCount.toLocaleString()} views</>}
              {h.industryCategory && <span style={{ color: "#888" }}> ({h.industryCategory})</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
