<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { joinSprintFormat, parseSprintFormat, SPRINT_TOKENS, type SprintFormatPart, type SprintTokenKey } from '@/common/sprintNaming';

// A sprint name format edited as text with tokens shown as chips ("Sprint [Year] Q[Quarter]"), so nobody has
// to remember {tokens}. The model is the format string; the chips are non-editable spans inside a
// contenteditable box, read back into the format on every input.
const format = defineModel<string>({ required: true });

const { errorMessages = [] } = defineProps<{
  errorMessages?: string[];
}>();

const editor = ref<HTMLDivElement | null>(null);
const focused = ref(false);

const labelOf = (key: SprintTokenKey) => SPRINT_TOKENS.find((t) => t.key === key)?.label ?? key;

const chipFor = (key: SprintTokenKey) => {
  const chip = document.createElement('span');
  chip.className = 'sprint-name-chip';
  chip.contentEditable = 'false';
  chip.dataset.token = key;
  chip.textContent = labelOf(key);
  return chip;
};

// Browsers can't put the caret right after a non-editable chip, so each chip is followed by a zero-width space
// for the caret to land in (left out again when reading)
const CARET_SPOT = '\u200b';

const render = () => {
  if (!editor.value) return;
  editor.value.replaceChildren(
    ...parseSprintFormat(format.value).flatMap((part) =>
      'token' in part ? [chipFor(part.token), document.createTextNode(CARET_SPOT)] : [document.createTextNode(part.text)],
    ),
  );
};

// The box's content back to a format: chips are tokens, everything else is text
const read = (): string => {
  const parts: SprintFormatPart[] = [];
  const walk = (node: Node) => {
    if (isChip(node)) parts.push({ token: node.dataset.token as SprintTokenKey });
    else if (node.nodeType === Node.TEXT_NODE)
      parts.push({ text: (node.textContent ?? '').replace(/\u00a0/g, ' ').split(CARET_SPOT).join('') });
    else node.childNodes.forEach(walk);
  };
  editor.value?.childNodes.forEach(walk);
  return joinSprintFormat(parts);
};

// Typing updates the model without re-rendering (that would lose the caret); outside changes re-render
let written = format.value;
const onInput = () => {
  written = read();
  format.value = written;
};
watch(format, (value) => {
  if (value !== written) {
    written = value;
    render();
  }
});
onMounted(render);

// Insert at the caret, or at the end when the caret isn't in the box. Buttons calling this should keep the
// focus here (@mousedown.prevent), so the caret stays where the user left it.
const insert = (key: SprintTokenKey) => {
  const box = editor.value;
  if (!box) return;
  const selection = window.getSelection();
  let range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range || !box.contains(range.commonAncestorContainer) || isChip(range.commonAncestorContainer.parentElement)) {
    range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
  }
  range.deleteContents();
  const chip = chipFor(key);
  const spot = document.createTextNode(CARET_SPOT);
  range.insertNode(spot);
  range.insertNode(chip);
  range.setStart(spot, 1);
  range.collapse(true);
  box.focus();
  selection?.removeAllRanges();
  selection?.addRange(range);
  onInput();
};

const placeCaret = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const isChip = (node: Node | null | undefined): node is HTMLElement => node instanceof HTMLElement && !!node.dataset.token;

// Clicking a chip would put the caret inside it, where typing does nothing: put it right after the chip
const onMousedown = (event: MouseEvent) => {
  const chip = (event.target as HTMLElement).closest('[data-token]');
  const after = chip?.nextSibling;
  if (!after) return;
  event.preventDefault();
  editor.value?.focus();
  placeCaret(after, after.textContent?.startsWith(CARET_SPOT) ? 1 : 0);
};

// A click on the field around the text (its padding, label) puts the caret at the end
const onFieldClick = (event: MouseEvent) => {
  const box = editor.value;
  if (!box || box.contains(event.target as Node)) return;
  box.focus();
  const last = box.lastChild;
  if (last?.nodeType === Node.TEXT_NODE) placeCaret(last, (last.textContent ?? '').length);
  else placeCaret(box, box.childNodes.length);
};

// The node just before the caret, past empty text and caret spots; null when there is text before it
const chipBefore = (node: Node, offset: number): Node | null => {
  const isBlank = (n: Node) => n.nodeType === Node.TEXT_NODE && !(n.textContent ?? '').split(CARET_SPOT).join('');
  let prev: Node | null;
  if (node.nodeType === Node.TEXT_NODE) {
    if ((node.textContent ?? '').slice(0, offset).split(CARET_SPOT).join('')) return null;
    prev = node.previousSibling;
  } else prev = node.childNodes[offset - 1] ?? null;
  while (prev && isBlank(prev)) prev = prev.previousSibling;
  return prev;
};

// Enter does nothing (one line); Backspace right after a chip removes the chip, not its invisible caret spot
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    return;
  }
  const selection = window.getSelection();
  if (event.key !== 'Backspace' || !selection?.isCollapsed || !selection.rangeCount) return;
  const { startContainer: node, startOffset: offset } = selection.getRangeAt(0);
  const before = chipBefore(node, offset);
  if (!isChip(before)) return;
  event.preventDefault();
  before.remove();
  onInput();
};

// One line of plain text: pasted text loses its formatting
const onPaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' ');
  const selection = window.getSelection();
  if (!text || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  onInput();
};

defineExpose({ insert });
</script>

<template>
  <VInput :error-messages="errorMessages" hide-details="auto">
    <VField label="Sprint name" active :focused="focused" :error="errorMessages.length > 0" @click="onFieldClick">
      <div
        ref="editor"
        class="sprint-name-input"
        contenteditable="true"
        role="textbox"
        aria-label="Sprint name"
        spellcheck="false"
        @input="onInput"
        @focus="focused = true"
        @blur="focused = false"
        @paste="onPaste"
        @mousedown="onMousedown"
        @keydown="onKeydown"
      />
    </VField>
  </VInput>
</template>

<style scoped>
.sprint-name-input {
  flex: 1 1 auto;
  min-height: 24px;
  padding: 24px 16px 6px;
  outline: none;
  white-space: pre-wrap;
  line-height: 1.75;
}

/* Tokens: a quiet outlined chip, like the chat's mentions */
.sprint-name-input :deep(.sprint-name-chip) {
  display: inline-block;
  margin: 0 2px;
  padding: 0 6px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: 0.8125rem;
  line-height: 1.5;
  user-select: none;
}
</style>
