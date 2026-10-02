import { loadNoteImageUrl } from '@/composables/useNoteImages';

import Image from '@tiptap/extension-image';

// Tiptap's Image, but the stored HTML is `<img data-image-id width height>`: the bytes live in the
// image store (noteImageStore.ts), never inline (base64 would bloat every notes read/search/backup).
// A plain `<img src>` (pasted web HTML, remote tracking pixels) doesn't match parseHTML and is dropped.
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-image-id'),
        renderHTML: (attrs) => ({ 'data-image-id': attrs.imageId }),
      },
      // Natural size, so the browser reserves the right box (aspect ratio) before the blob loads
      width: { default: null },
      height: { default: null },
      alt: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-image-id]' }];
  },

  // Image's markdown `![](src)` input rule would create an image without an imageId
  addInputRules() {
    return [];
  },

  addNodeView() {
    return ({ node }) => {
      const img = document.createElement('img');
      img.dataset.imageId = node.attrs.imageId;
      if (node.attrs.width) img.width = node.attrs.width;
      if (node.attrs.height) img.height = node.attrs.height;
      img.alt = node.attrs.alt ?? '';
      void loadNoteImageUrl(node.attrs.imageId).then((url) => {
        if (url) img.src = url;
        else {
          img.alt = 'Image not found';
          img.classList.add('note-image--missing');
        }
      });
      return {
        dom: img,
        // Same image → keep the element (no reload/flicker); anything else → rebuild
        update: (next) => next.type === node.type && next.attrs.imageId === node.attrs.imageId,
      };
    };
  },
});
