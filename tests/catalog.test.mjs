import assert from "node:assert/strict";
import test from "node:test";
import {
  countCatalog,
  filterCatalog,
  formatCountdown,
  formatDuration,
  isPlayableConference,
} from "../src/catalog.js";

const videos = [
  {
    id: "youtube:abcdefghijk",
    source: "youtube",
    videoId: "abcdefghijk",
    embeddable: true,
    title: "Conférence IA générative",
    channel: "Université Test",
    description: "Recherche et agents IA",
    status: "live",
    publishedAt: "2026-09-06T12:00:00.000Z",
    language: "fr",
    topics: ["IA générative", "Agents IA", "Français"],
    score: 92,
  },
  {
    id: "youtube:lmnopqrstuv",
    source: "youtube",
    videoId: "lmnopqrstuv",
    embeddable: true,
    title: "AI security keynote",
    channel: "Research Lab",
    description: "A long technical talk",
    status: "replay",
    publishedAt: "2026-05-01T12:00:00.000Z",
    language: "en",
    topics: ["Cybersécurité", "Recherche", "Anglais"],
    score: 81,
  },
];

test("formatDuration produit des durées lisibles", () => {
  assert.equal(formatDuration(7440), "2 h 04");
  assert.equal(formatDuration(937), "15 min");
  assert.equal(formatDuration(null), "Durée variable");
});

test("formatCountdown gère les événements futurs", () => {
  const now = new Date("2026-09-07T12:00:00.000Z").getTime();
  assert.equal(formatCountdown("2026-09-08T14:30:00.000Z", now), "Dans 1 j 2 h");
  assert.equal(formatCountdown("2026-09-07T12:20:00.000Z", now), "Dans 20 min");
});

test("filterCatalog combine recherche, langue, thème et favoris", () => {
  const base = { status: "all", topic: "all", language: "all", date: "all", source: "all", query: "" };
  assert.equal(filterCatalog(videos, { ...base, language: "fr" }).length, 1);
  assert.equal(filterCatalog(videos, { ...base, topic: "Cybersécurité" }).length, 1);
  assert.equal(filterCatalog(videos, { ...base, query: "universite" }).length, 1);
  assert.equal(filterCatalog(videos, { ...base, status: "favorites" }, new Set([videos[1].id])).length, 1);
});

test("seules les sources internes valides sont déclarées lisibles", () => {
  assert.equal(isPlayableConference(videos[0]), true);
  assert.equal(isPlayableConference({ ...videos[0], embeddable: false }), false);
  assert.equal(isPlayableConference({ ...videos[0], videoId: "bad" }), false);
  assert.equal(
    isPlayableConference({
      ...videos[0],
      id: "hls:test",
      source: "hls",
      videoId: undefined,
      playbackUrl: "https://media.example.test/live.m3u8",
    }),
    true,
  );
  assert.equal(
    isPlayableConference({
      ...videos[0],
      id: "mp4:test",
      source: "mp4",
      videoId: undefined,
      playbackUrl: "javascript:alert(1)",
    }),
    false,
  );
  assert.equal(
    isPlayableConference({
      ...videos[0],
      id: "mp4:wrong-extension",
      source: "mp4",
      videoId: undefined,
      playbackUrl: "https://media.example.test/live.m3u8",
    }),
    false,
  );
});

test("countCatalog sépare les statuts", () => {
  assert.deepEqual(countCatalog(videos), { total: 2, live: 1, upcoming: 0, replay: 1 });
});
