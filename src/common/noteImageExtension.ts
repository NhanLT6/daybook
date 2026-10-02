import { loadNoteImageUrl } from '@/composables/useNoteImages';

import { ResizableNodeView } from '@tiptap/core';
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
      // Display size: natural size when pasted, the dragged size after a resize. Also gives the browser
      // the aspect ratio, so the right box is reserved before the blob loads.
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

  // Image's own `resize` option can't be used: its node view loads `src`, ours loads the blob by id.
  // So this builds the same ResizableNodeView around our <img>.
  addNodeView() {
    return ({ node, getPos, editor }) => {
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

      const view = new ResizableNodeView({
        element: img,
        editor,
        node,
        getPos,
        // Unlike Image's version, don't leave the image node-selected: the next keystroke would replace it
        onCommit: (width, height) => {
          const pos = getPos();
          const current = pos === undefined ? null : editor.state.doc.nodeAt(pos);
          if (pos === undefined || current?.type.name !== this.name) return;
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, {
              ...current.attrs,
              width: Math.round(width),
              height: Math.round(height),
            }),
          );
        },
        // Same image → keep the element (no reload/flicker), just follow its size (e.g. undo of a resize)
        onUpdate: (next) => {
          if (next.attrs.imageId !== node.attrs.imageId) return false;
          if (next.attrs.width) img.style.width = `${next.attrs.width}px`;
          return true;
        },
        options: {
          directions: ['bottom-left', 'bottom-right'],
          min: { width: 48, height: 24 },
          preserveAspectRatio: true,
        },
      });

      // ResizableNodeView only ends a resize on mouseup and has no touchend listener: without this a
      // touch resize never commits. Its mouseup handler ignores the event unless a resize is running.
      view.dom.addEventListener('touchstart', (e) => {
        if (!(e.target as HTMLElement).dataset?.resizeHandle) return;
        const listening = new AbortController();
        const end = () => {
          listening.abort();
          document.dispatchEvent(new MouseEvent('mouseup'));
        };
        document.addEventListener('touchend', end, { signal: listening.signal });
        document.addEventListener('touchcancel', end, { signal: listening.signal });
      });

      return view;
    };
  },
});
