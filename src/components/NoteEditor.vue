<script setup lang="ts">
import { computed, ref } from 'vue';

import { addNoteImage } from '@/composables/useNoteImages';

import NoteImageViewer from '@/components/NoteImageViewer.vue';

import { NOTE_COLORS } from '@/interfaces/Note';

import type { NoteColor } from '@/interfaces/Note';

import dayjs from 'dayjs';

import { NoteImage } from '@/common/noteImageExtension';
import { NOTE_IMAGE_MIME_TYPES } from '@/common/prepareNoteImage';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { FileHandler } from '@tiptap/extension-file-handler';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Selection, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';

// content is the INITIAL value only — never watched back into the editor (would reset cursor/selection)
const props = defineProps<{ content: string; updatedAt?: number; pinned?: boolean; color?: NoteColor }>();

const emit = defineEmits<{
  update: [html: string, isEmpty: boolean];
  back: [];
  delete: [];
  togglePin: [];
  color: [color: NoteColor | undefined];
}>();

const notificationCenter = useNotificationCenterStore();

// Stores each file in the image store, then inserts the nodes in one go (at the drop point, or the cursor)
async function insertImages(files: File[], pos?: number) {
  const results = await Promise.allSettled(files.map((f) => addNoteImage(f)));
  const nodes = results.flatMap((r) => (r.status === 'fulfilled' ? [{ type: 'image', attrs: r.value }] : []));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    const quota = failed.reason instanceof DOMException && failed.reason.name === 'QuotaExceededError';
    notificationCenter.error('Could not add image', {
      message: quota ? 'Browser storage is full' : failed.reason instanceof Error ? failed.reason.message : undefined,
    });
  }
  const e = editor.value;
  if (!nodes.length || !e || e.isDestroyed) return;
  e.chain()
    .focus()
    .insertContentAt(pos ?? e.state.selection, nodes)
    // Insertion leaves the last image node-selected, so the next keystroke would replace it: move the
    // cursor into the text after it, adding a paragraph when the image ended up last
    .command(({ tr }) => {
      const end = tr.selection.to;
      const next = Selection.findFrom(tr.doc.resolve(end), 1, true);
      if (next) tr.setSelection(next);
      else
        tr.insert(end, tr.doc.type.schema.nodes.paragraph.create()).setSelection(TextSelection.create(tr.doc, end + 1));
      return true;
    })
    .run();
}

const editor = useEditor({
  content: props.content,
  autofocus: 'end',
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Ticket reminder, question for daily…' }),
    NoteImage,
    FileHandler.configure({
      allowedMimeTypes: NOTE_IMAGE_MIME_TYPES,
      // "Copy image" in a browser also puts `<img src=remote>` HTML on the clipboard; the file is enough
      consumePasteEvent: true,
      onPaste: (_e, files) => void insertImages(files),
      onDrop: (_e, files, pos) => void insertImages(files, pos),
    }),
  ],
  editorProps: {
    // Click an image to zoom it (instead of selecting it); Backspace/Delete next to it still removes it
    handleClickOn: (_view, _pos, node, _nodePos, event) => {
      const img = event.target;
      if (node.type.name !== 'image' || !(img instanceof HTMLImageElement) || !img.currentSrc) return false;
      viewer.value = { open: true, src: img.currentSrc, alt: img.alt, target: img };
      // VDialog only takes focus after its open transition: until then keys would still edit the note
      (document.activeElement as HTMLElement | null)?.blur();
      return true;
    },
  },
  onUpdate: ({ editor: e }) => emit('update', e.getHTML(), e.isEmpty),
});

const viewer = ref<{ open: boolean; src?: string; alt?: string; target?: HTMLElement }>({ open: false });

// Toolbar image button (also the way in on phones, where paste is awkward)
const fileInput = ref<HTMLInputElement>();
function onPickImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])].filter((f) => NOTE_IMAGE_MIME_TYPES.includes(f.type));
  input.value = '';
  if (files.length) void insertImages(files);
}

const updatedAtLabel = computed(() => (props.updatedAt ? dayjs(props.updatedAt).format('MMM D, HH:mm') : null));
</script>

<template>
  <!-- Root fills its container; header/toolbar are fixed rows, content scrolls in the remaining space -->
  <div class="note-editor" @keydown.esc="!viewer.open && emit('back')">
    <!-- Header: back/delete + last-updated timestamp -->
    <div class="d-flex align-center px-2 py-1">
      <VBtn icon="mdi-arrow-left" variant="text" size="small" aria-label="Back to notes" @click="emit('back')" />
      <VSpacer />
      <span v-if="updatedAtLabel" class="text-caption text-medium-emphasis mr-1">{{ updatedAtLabel }}</span>
      <VBtn
        :icon="pinned ? 'mdi-pin' : 'mdi-pin-outline'"
        variant="text"
        size="small"
        :aria-label="pinned ? 'Unpin note' : 'Pin note'"
        :title="pinned ? 'Unpin' : 'Pin'"
        @click="emit('togglePin')"
      />
      <!-- Color: default surface + fixed pastel set (theme colors, so dark mode has its own tints) -->
      <VMenu location="bottom end" offset="4">
        <template #activator="{ props: menuProps }">
          <VBtn
            v-bind="menuProps"
            icon="mdi-palette-outline"
            variant="text"
            size="small"
            aria-label="Note color"
            title="Color"
          />
        </template>
        <VCard elevation="6" class="d-flex ga-2 pa-2">
          <button
            v-for="c in [undefined, ...NOTE_COLORS]"
            :key="c ?? 'default'"
            type="button"
            class="note-swatch"
            :class="[c ? `bg-note-${c}` : 'bg-surface', { 'note-swatch--active': c === color }]"
            :aria-label="c ? `Color ${c}` : 'Default color'"
            :title="c ?? 'default'"
            @click="emit('color', c)"
          >
            <VIcon v-if="c === color" icon="mdi-check" size="16" />
          </button>
        </VCard>
      </VMenu>
      <VBtn icon="mdi-delete-outline" variant="text" size="small" aria-label="Delete note" @click="emit('delete')" />
    </div>

    <!-- Toolbar: formatting commands, active state reflects current selection.
         mousedown.prevent keeps focus in the editor; otherwise the button keeps it and typing is lost. -->
    <div class="d-flex align-center ga-1 px-2 pb-1">
      <VBtn
        icon="mdi-format-bold"
        variant="text"
        size="small"
        :color="editor?.isActive('bold') ? 'primary' : 'default'"
        aria-label="Bold"
        title="Bold"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleBold().run()"
      />
      <VBtn
        icon="mdi-format-italic"
        variant="text"
        size="small"
        :color="editor?.isActive('italic') ? 'primary' : 'default'"
        aria-label="Italic"
        title="Italic"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleItalic().run()"
      />
      <VBtn
        icon="mdi-format-strikethrough"
        variant="text"
        size="small"
        :color="editor?.isActive('strike') ? 'primary' : 'default'"
        aria-label="Strikethrough"
        title="Strikethrough"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleStrike().run()"
      />
      <VBtn
        icon="mdi-format-list-bulleted"
        variant="text"
        size="small"
        :color="editor?.isActive('bulletList') ? 'primary' : 'default'"
        aria-label="Bullet list"
        title="Bullet list"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleBulletList().run()"
      />
      <VBtn
        icon="mdi-format-list-checks"
        variant="text"
        size="small"
        :color="editor?.isActive('taskList') ? 'primary' : 'default'"
        aria-label="Checklist"
        title="Checklist"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleTaskList().run()"
      />
      <VBtn
        icon="mdi-image-outline"
        variant="text"
        size="small"
        aria-label="Insert image"
        title="Insert image (or paste / drop one)"
        @mousedown.prevent
        @click="fileInput?.click()"
      />
      <input
        ref="fileInput"
        type="file"
        :accept="NOTE_IMAGE_MIME_TYPES.join(',')"
        multiple
        hidden
        @change="onPickImages"
      />
    </div>

    <EditorContent :editor="editor" class="note-content" />

    <!-- Zoomed image; focus goes back to the text once it's gone -->
    <NoteImageViewer
      v-model="viewer.open"
      :src="viewer.src"
      :alt="viewer.alt"
      :target="viewer.target"
      @closed="editor?.commands.focus()"
    />
  </div>
</template>

<style scoped>
.note-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* EditorContent's wrapper fills remaining space and scrolls on its own */
.note-editor :deep(.note-content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.note-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: pointer;
}

.note-swatch--active {
  border: 2px solid rgb(var(--v-theme-primary));
}

/* Images zoom on click; a keyboard-selected one gets a ring */
.note-editor :deep(.ProseMirror img) {
  cursor: zoom-in;
}

.note-editor :deep(.ProseMirror img.ProseMirror-selectednode) {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Full height so clicking empty space below the text still focuses the editor */
.note-editor :deep(.ProseMirror) {
  min-height: 100%;
  padding: 4px 12px 12px;
}
</style>
