import { fetchJson } from "$lib/data";

export type Snapshot = {
  thumb: string;
  page: string;
  by: string;
  license: string;
  caption?: string;
};

export type Said = { text: string; page: string };

type Album = {
  photos: Record<string, Array<Snapshot>>;
  says: Record<string, Said>;
  of: Record<string, string>;
  /**
   * Like `of`, minus breeds whose article is about a different dog.
   */
  about: Record<string, string>;
};

const cache: { album?: Promise<Album> } = {};

async function album(): Promise<Album> {
  cache.album ??= fetchJson<Album>(fetch, "/data/breed-photos.json");

  return cache.album;
}

export async function photosOf(breed: string): Promise<Array<Snapshot>> {
  const loaded = await album();

  return loaded.photos[loaded.of[breed] ?? ""] ?? [];
}

export async function saidOf(breed: string): Promise<Said | null> {
  const loaded = await album();

  return loaded.says[loaded.about[breed] ?? ""] ?? null;
}
