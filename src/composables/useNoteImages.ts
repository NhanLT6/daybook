import { shallowReactive } from 'vue';

import { prepareNoteImage } from '@/common/prepareNoteImage';
import { deleteNoteImages, getNoteImage, getNoteImageIdsBefore, putNoteImages } from '@/db/noteImageStore';
import { nanoid } from 'nanoid';

// Unreferenced images are only swept once they're this old: covers a note that isn't saved yet, the
// delete-undo window, editor undo (Ctrl+Z) bringing a removed image back, and other open tabs.
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const IMAGE_ID_ATTR = /data-image-id="([\w-]+)"/g;

// id → object URL. Shared by every card preview and editor; reactive so previews re-render once a blob loads.
// URLs live for the page's lifetime (revoked only when the sweep deletes the image) — a few per note at most.
const urls = shallowReactive(new Map<string, string>());
const missing = shallowReactive(new Set<string>());
const pending = new Map<string, Promise<string | undefined>>();

export function loadNoteImageUrl(id: string): Promise<string | undefined> {
  const cached = urls.get(id);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(id);
  if (!p) {
    p = getNoteImage(id)
      .then((record) => {
        if (!record) {
          missing.add(id);
          return undefined;
        }
        const url = URL.createObjectURL(record.blob);
        urls.set(id, url);
        return url;
      })
      .catch(() => undefined)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

// Sync, reactive lookup for computed previews: undefined until the blob is loaded (kicks off the load).
export function noteImageUrl(id: string): string | undefined {
  const url = urls.get(id);
  if (!url && !missing.has(id)) void loadNoteImageUrl(id);
  return url;
}

export async function addNoteImage(file: Blob): Promise<{ imageId: string; width: number; height: number }> {
  const { blob, width, height } = await prepareNoteImage(file);
  const id = nanoid();
  await putNoteImages([{ id, blob, width, height, createdAt: Date.now() }]);
  urls.set(id, URL.createObjectURL(blob));
  return { imageId: id, width, height };
}

export function referencedImageIds(html: string): string[] {
  return [...html.matchAll(IMAGE_ID_ATTR)].map((m) => m[1]);
}

// Deletes images no note references any more (removed from a note, or the note was deleted).
export async function sweepOrphanNoteImages(noteContents: string[], now = Date.now()): Promise<number> {
  const referenced = new Set(noteContents.flatMap(referencedImageIds));
  const orphans = (await getNoteImageIdsBefore(now - ORPHAN_GRACE_MS)).filter((id) => !referenced.has(id));
  if (!orphans.length) return 0;
  await deleteNoteImages(orphans);
  for (const id of orphans) {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
  }
  return orphans.length;
}
