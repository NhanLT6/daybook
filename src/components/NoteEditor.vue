<script setup lang="ts">
import { computed } from 'vue';

import { NOTE_COLORS, type NoteColor } from '@/interfaces/Note';

import dayjs from 'dayjs';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
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

const editor = useEditor({
  content: props.content,
  autofocus: 'end',
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Ticket reminder, question for daily…' }),
  ],
  onUpdate: ({ editor: e }) => emit('update', e.getHTML(), e.isEmpty),
});

const updatedAtLabel = computed(() => (props.updatedAt ? dayjs(props.updatedAt).format('MMM D, HH:mm') : null));
</script>

<template>
  <!-- Root fills its container; header/toolbar are fixed rows, content scrolls in the remaining space -->
  <div class="note-editor" @keydown.esc="emit('back')">
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
    </div>

    <EditorContent :editor="editor" class="note-content" />
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

/* Full height so clicking empty space below the text still focuses the editor */
.note-editor :deep(.ProseMirror) {
  min-height: 100%;
  padding: 4px 12px 12px;
}
</style>
