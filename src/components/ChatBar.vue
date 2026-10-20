<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { type ChatCommand, CHAT_COMMANDS, suggestChatCommands } from '@/common/chatCommands';
import { useAiChat } from '@/composables/useAiChat';
import { noticeColor, useChatNotices } from '@/composables/useChatNotices';
import { fetchCatchUpItems } from '@/composables/useCatchUpSummary';
import { type ChatConversation, useChatHistory } from '@/composables/useChatHistory';
import { useDailyTarget } from '@/composables/useDailyTarget';
import { useTimeLogs } from '@/composables/useTimeLogs';
import { useWorkspace } from '@/composables/useWorkspace';

import type { DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { NotificationItem } from '@/stores/notificationCenter';
import type { TimeLog } from '@/interfaces/TimeLog';
import type { TextUIPart } from 'ai';

import { storeToRefs } from 'pinia';
import { useDisplay } from 'vuetify';

import dayjs from 'dayjs';

import { parseChatCommand } from '@/common/chatCommands';
import { useStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { uniqBy } from 'lodash';
import { nanoid } from 'nanoid';
import { useRouter } from 'vue-router';

import AiChatMessage from './AiChatMessage.vue';
import ChatNotice from './ChatNotice.vue';

/*
 * Glass chat bar docked at the bottom centre of every page, and the app's notification surface.
 * hidden: a line of light in the bottom gutter; hovering the bottom edge lights it, and after a
 *         320ms dwell it opens. Ctrl+K or / reveal it too. A notification turns it into a toast.
 * bar:    the composer alone. Stays while it holds a draft; hides on mouse leave when empty.
 * open:   the conversation (or its history) above the composer, up to 2/3 of the screen.
 * The chat element is the line itself: it morphs from the lit line into the toast, bar or panel
 * and folds back into it (morphTo), with a turning rim of the same light around it.
 */
type BarState = 'hidden' | 'bar' | 'open';
// What is drawn: the line (hidden), the notification toast (hidden), the bar or the panel
type Shape = 'peek' | 'toast' | 'bar' | 'open';

const {
  messages,
  isLoading,
  error,
  latestLogsMessageId,
  savedLogsMessageId,
  sendMessage,
  markSaved,
  markUndone,
  markDiscarded,
  injectCatchUp,
  loadMessages,
  clearMessages,
} = useAiChat();

const { conversations, upsert, get: getConversation } = useChatHistory();
const { addMany: addLogs, remove: removeLog } = useTimeLogs();
const { addProjects, addTasks, allProjects: projects, allTasks: tasks } = useWorkspace();
const notificationCenter = useNotificationCenterStore();
const { sortedItems: notifications, isExpanded: notificationsExpanded } = storeToRefs(notificationCenter);
const { notice, dropPassive, dropAll } = useChatNotices();
const router = useRouter();
const { targetMinutes } = useDailyTarget();
const { xs, mdAndUp } = useDisplay();

const rootEl = ref<HTMLElement | null>(null);
const chatEl = ref<HTMLElement | null>(null);
const rimEl = ref<HTMLElement | null>(null);
const haloEl = ref<HTMLElement | null>(null);
const notifsEl = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const headEl = ref<HTMLElement | null>(null);
const threadEl = ref<HTMLElement | null>(null);
const historyEl = ref<HTMLElement | null>(null);
const composerEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);

const state = ref<BarState>('hidden');
// ── Shortcut tip ──────────────────────────────────────────

// The shortcut tip shows until the bar has been opened with / or Ctrl+K once
const knowsShortcut = useStorage(storageKeys.chat.shortcutLearned, false);

const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
const restState = (): BarState => (isTouch ? 'bar' : 'hidden'); // touch has no hover, so the bar stays

// ── Conversation & history ─────────────────────────────────────────────────

// Id of the conversation on screen; null = a new chat that has no messages yet
const currentId = ref<string | null>(null);
const showHistory = ref(false);
const historyIndex = ref(0); // keyboard highlight in the history list
let chatBeforeHistory: string | null = null; // → returns here

// Keep the current conversation in history whenever a turn settles (or a save/undo changes it)
watch([messages, isLoading], () => {
  if (isLoading.value || !messages.value.length) return;
  if (!currentId.value) currentId.value = nanoid();
  upsert(currentId.value, messages.value);
});

// Oldest at the top, today at the bottom next to the composer
const orderedHistory = computed(() => [...conversations.value].reverse());

const dayLabel = (ts: number) => {
  const d = dayjs(ts);
  if (d.isSame(dayjs(), 'day')) return 'Today';
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday';
  return d.format(d.isSame(dayjs(), 'year') ? 'ddd D MMM' : 'D MMM YYYY');
};

const historyRows = computed(() =>
  orderedHistory.value.map((c, i, list) => ({
    conversation: c,
    index: i,
    day: dayLabel(c.updatedAt),
    showDay: i === 0 || dayLabel(list[i - 1].updatedAt) !== dayLabel(c.updatedAt),
    color: c.command ? `cmd-${c.command}` : 'primary',
    commandDef: CHAT_COMMANDS.find((cmd) => cmd.name === c.command),
  })),
);

const showConversation = (conversation: ChatConversation | undefined) => {
  if (!conversation) {
    clearMessages();
    currentId.value = null;
  } else {
    // Plain copy: the stored array is reactive, and the chat keeps its own messages
    loadMessages(JSON.parse(JSON.stringify(conversation.messages)) as DaybookUIMessage[]);
    currentId.value = conversation.id;
  }
};

const openHistory = () => {
  chatBeforeHistory = currentId.value;
  const at = orderedHistory.value.findIndex((c) => c.id === currentId.value);
  historyIndex.value = at >= 0 ? at : orderedHistory.value.length - 1;
  showHistory.value = true;
  setState('open');
};

const backToChat = () => {
  showHistory.value = false;
  if (currentId.value !== chatBeforeHistory) showConversation(chatBeforeHistory ? getConversation(chatBeforeHistory) : undefined);
};

const openConversation = (conversation: ChatConversation) => {
  if (isLoading.value && conversation.id !== currentId.value) return; // let the running turn finish first
  showHistory.value = false;
  if (conversation.id !== currentId.value) showConversation(conversation);
  focusInput();
};

const newChat = () => {
  if (isLoading.value) return;
  showHistory.value = false;
  showConversation(undefined);
  focusInput();
};

const toggleHistory = () => {
  if (showHistory.value) backToChat();
  else openHistory();
  focusInput();
};

const title = computed(() => {
  if (showHistory.value) return 'History · ↑↓ select · Enter open · → back';
  return currentId.value ? (getConversation(currentId.value)?.title ?? 'Chat') : 'New chat';
});

// ── Composer ───────────────────────────────────────────────────────────────

const inputText = ref('');
const command = ref<ChatCommand | null>(null); // shown as a chip in front of the text
const attachedFile = ref<File | null>(null);
const attachedPreview = ref<string | null>(null);
const isDragOver = ref(false);

const hasDraft = computed(() => !!inputText.value.trim() || !!command.value || !!attachedFile.value);
const canSend = computed(
  () => !isLoading.value && (!!inputText.value.trim() || !!attachedFile.value || command.value?.name === 'catchup'),
);
const placeholder = computed(() => {
  if (isDragOver.value) return 'Drop image here…';
  if (command.value) return `${command.value.hint}…`;
  return xs.value ? 'What did you work on?' : 'What did you work on? / for commands'; // the long one clips on phones
});

const focusInput = () => inputEl.value?.focus({ preventScroll: true });

const autosize = () => {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = '21px';
  el.style.height = `${Math.min(el.scrollHeight, 105)}px`;
};

// Slash menu: open while the user types the command word (`/`, `/no`)
const menuDismissed = ref(false); // Esc hides it until the text changes
const menuIndex = ref(0);
const suggestions = computed(() => (command.value || menuDismissed.value ? [] : suggestChatCommands(inputText.value)));
const menuOpen = computed(() => suggestions.value.length > 0);

watch(inputText, async (text) => {
  menuDismissed.value = false;
  menuIndex.value = 0;
  // Typing "/note " turns the word into a chip
  const typed = /^\/(\w+)\s$/.exec(text);
  const match = typed && !command.value && CHAT_COMMANDS.find((c) => c.name === typed[1].toLowerCase());
  if (match) {
    pickCommand(match);
    return;
  }
  await nextTick();
  autosize();
});

const pickCommand = (picked: ChatCommand) => {
  command.value = picked;
  inputText.value = '';
  focusInput();
  if (picked.name === 'catchup') void send(); // needs no text
};

const clearDraft = () => {
  inputText.value = '';
  command.value = null;
  removeAttachment();
  focusInput();
};

const attachImage = (file: File) => {
  attachedFile.value = file;
  attachedPreview.value = URL.createObjectURL(file);
};

const removeAttachment = () => {
  if (attachedPreview.value) URL.revokeObjectURL(attachedPreview.value);
  attachedFile.value = null;
  attachedPreview.value = null;
  if (fileInputEl.value) fileInputEl.value.value = '';
};

const onFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) attachImage(file);
};

const onPaste = (event: ClipboardEvent) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (!file) return;
  event.preventDefault();
  attachImage(file);
};

const onDrop = (event: DragEvent) => {
  isDragOver.value = false;
  const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
  if (file) attachImage(file);
};

const onKeydown = (e: KeyboardEvent) => {
  const el = e.target as HTMLTextAreaElement;

  if (menuOpen.value) {
    const count = suggestions.value.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      menuIndex.value = (menuIndex.value + (e.key === 'ArrowDown' ? 1 : count - 1)) % count;
      return;
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault();
      pickCommand(suggestions.value[menuIndex.value]);
      return;
    }
  }

  // Backspace at the very start drops the chip back into editable text
  if (e.key === 'Backspace' && command.value && el.selectionStart === 0 && el.selectionEnd === 0) {
    e.preventDefault();
    const name = command.value.name;
    command.value = null;
    inputText.value = `/${name}${inputText.value}`;
    return;
  }

  // Arrow keys move between the chat and its history while the composer is empty
  if (!inputText.value && !command.value && !attachedFile.value) {
    if (showHistory.value) {
      const n = orderedHistory.value.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        historyIndex.value = Math.max(0, Math.min(n - 1, historyIndex.value + (e.key === 'ArrowDown' ? 1 : -1)));
        void nextTick(scrollToHighlight);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const picked = orderedHistory.value[historyIndex.value];
        if (picked) openConversation(picked);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        backToChat();
        return;
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      openHistory();
      return;
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void send();
  }
};

// ── Sending ────────────────────────────────────────────────────────────────

const isCatchUpLoading = ref(false);

const runCatchUp = async () => {
  if (isCatchUpLoading.value || isLoading.value) return;
  isCatchUpLoading.value = true;
  try {
    const items = await fetchCatchUpItems(targetMinutes.value);
    if (items?.length) injectCatchUp(items);
    else error.value = 'No recent logs to summarize.';
  } catch (err) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    error.value = axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to load catch-up.');
  } finally {
    isCatchUpLoading.value = false;
  }
};

const send = async () => {
  if (!canSend.value) return;
  // A pasted "/note foo" counts the same as a picked chip
  const parsed = command.value ? undefined : parseChatCommand(inputText.value.trim());
  const cmd = command.value ?? parsed?.command ?? null;
  const text = parsed?.command ? parsed.rest : inputText.value.trim();
  if (cmd && cmd.name !== 'catchup' && !text && !attachedFile.value) return; // a bare command isn't a message yet
  const file = attachedFile.value;

  inputText.value = '';
  command.value = null;
  attachedFile.value = null;
  attachedPreview.value = null;
  showHistory.value = false;
  setState('open');
  focusInput(); // keep typing after a click on Send

  if (cmd?.name === 'catchup') {
    await runCatchUp();
    return;
  }
  // The text keeps its /command prefix so the conversation still shows what each message was
  await sendMessage(cmd ? `/${cmd.name} ${text}` : text, file, projects.value, tasks.value, cmd?.name);
};

const lastUserMessageId = computed(() => [...messages.value].reverse().find((m) => m.role === 'user')?.id ?? null);

const retry = async (messageId: string) => {
  const msg = messages.value.find((m) => m.id === messageId);
  const text = msg?.parts.find((p): p is TextUIPart => p.type === 'text')?.text ?? '';
  const { command: cmd } = parseChatCommand(text);
  await sendMessage(text, null, projects.value, tasks.value, cmd?.name === 'catchup' ? undefined : cmd?.name);
};

const isConfigError = computed(() => error.value?.includes('not set up') ?? false);

const openSettings = () => {
  close();
  void router.push('/setting');
};

// ── Saving logs ────────────────────────────────────────────────────────────

// Ids of the last saved batch, for Undo. AI dates are already ISO YYYY-MM-DD
const lastSavedLogIds = ref<string[]>([]);

const saveLogs = async (messageId: string, extracted: ExtractedLog[]) => {
  markSaved(messageId);
  const toSave = extracted.map(
    (log) =>
      ({
        id: nanoid(),
        date: log.date,
        project: log.project,
        task: log.task,
        duration: log.duration,
        type: log.duration ? 'log' : 'plan',
        description: log.description,
      }) as TimeLog & { id: string },
  );
  await addLogs(toSave);
  lastSavedLogIds.value = toSave.map((l) => l.id);

  // New projects and tasks join the stored lists, same as a CSV import
  await addProjects(uniqBy(extracted.map((log) => ({ title: log.project })), 'title'));
  await addTasks(
    uniqBy(
      extracted.filter((log) => log.task).map((log) => ({ project: log.project, title: log.task! })),
      (t) => `${t.project}-${t.title}`,
    ),
  );
  notificationCenter.success(`${extracted.length} log${extracted.length > 1 ? 's' : ''} saved`);
};

const undoLogs = async (messageId: string) => {
  markUndone(messageId);
  for (const id of lastSavedLogIds.value) await removeLog(id);
  lastSavedLogIds.value = [];
  notificationCenter.info('Logs removed');
};

// ── Show / hide ────────────────────────────────────────────────────────────

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const setState = (next: BarState) => {
  const prev = state.value;
  if (next === prev) return;
  state.value = next;
  if (next !== 'open') showHistory.value = false;
  // Crossing between hidden and shown ends passive notices; one with actions moves across
  // (toast ↔ the pill above the chat) so it stays reachable
  if (prev === 'hidden' || next === 'hidden') dropPassive();
};

// ── Morph: peek ⇄ toast / bar ⇄ panel ─────────────────────────────────────

// iOS-style sheet curve: fast start, long soft settle, no overshoot
const EASE = 'cubic-bezier(.32,.72,0,1)';
const CLOSE_EASE = 'cubic-bezier(.5,0,.2,1)';
const MORPH_MS = 420; // between peek, toast, bar and panel
// The rim is bright while the chat rises out of the peek, then settles to a quiet outline
const RIM_REST = 0.75;
const HALO_REST = 0; // the glow only flashes during the morph; at rest only the rim carries colour

const shape = ref<Shape>('peek');
const desiredShape = computed<Shape>(() => (state.value === 'hidden' ? (notice.value ? 'toast' : 'peek') : state.value));

// The light takes the notification's colour while the toast shows (and while it folds away)
const tint = ref<string | null>(null);
const lightStyle = computed(() => {
  if (!tint.value) return {};
  const c = `rgb(var(--v-theme-${tint.value}))`;
  return {
    '--halo-grad': `linear-gradient(90deg, ${c}, ${c})`,
    '--rim-stops': `${c}, transparent 35%, ${c} 50%, transparent 85%, ${c}`,
  };
});

// The peek lifts a little and its rim lights up while the pointer dwells on it
const peekLit = ref(false);

interface Geo {
  w: number;
  h: number;
  r: number;
  b: number;
}

const measure = (el: HTMLElement): Geo => {
  const rect = el.getBoundingClientRect();
  return {
    w: rect.width,
    h: rect.height,
    r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
    b: window.innerHeight - rect.bottom,
  };
};
const frame = (g: Geo) => ({ width: `${g.w}px`, height: `${g.h}px`, borderRadius: `${g.r}px`, bottom: `${g.b}px` });

let morphAnim: Animation | undefined;
let rimAnim: Animation | undefined;
let haloAnim: Animation | undefined;
let morphToken = 0;

// Inline, not a class: Vue rewrites the class list on render and could drop it mid-morph
const freeze = (frozen: boolean) => {
  const el = chatEl.value;
  if (!el) return;
  el.style.transition = frozen ? 'none' : '';
  el.style.overflow = frozen ? 'hidden' : '';
  if (bodyEl.value) bodyEl.value.style.transition = frozen ? 'none' : '';
};

const stopMorph = () => {
  morphAnim?.cancel();
  morphAnim = undefined;
  freeze(false);
};

const light = (opening: boolean, duration: number, easing: string) => {
  rimAnim?.cancel();
  haloAnim?.cancel();
  rimAnim = rimEl.value?.animate(
    opening ? [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: RIM_REST }] : [{ opacity: RIM_REST }, { opacity: 1 }],
    { duration, easing, fill: 'forwards' },
  );
  haloAnim = haloEl.value?.animate(
    [{ opacity: opening ? 0.5 : HALO_REST }, { opacity: opening ? HALO_REST : 0.5 }],
    { duration, easing, fill: 'forwards' },
  );
};

// Contents zoom up from 92% and sharpen: opening and zooming, not bouncing
const zoomIn = (el: Element | null | undefined, delay: number) =>
  el?.animate(
    [
      { opacity: 0, transform: 'scale(.92)', filter: 'blur(5px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ],
    { duration: 340, delay, easing: EASE, fill: 'backwards' },
  );

const partsOf = (s: Shape): (Element | null)[] => {
  const el = chatEl.value;
  if (!el) return [];
  if (s === 'toast') return [el.querySelector('.chat-toast')];
  if (s === 'bar') return [composerEl.value, el.querySelector('.chat-tip')];
  if (s === 'open') return [bodyEl.value, composerEl.value];
  return [el.querySelector('.chat-peek')];
};

const morphTo = async (next: Shape) => {
  const el = chatEl.value;
  const prev = shape.value;
  if (!el || next === prev) return;
  const token = ++morphToken;
  // Measure before cancelling, so an interrupted morph carries on from where it is
  const from = measure(el);
  stopMorph();
  trackFrame(MORPH_MS + 60);

  if (next === 'toast') tint.value = notice.value ? noticeColor(notice.value.kind) : tint.value;
  else if (next !== 'peek') tint.value = null; // the open chat wears its own light, not the last toast's
  const before = partsOf(prev);
  shape.value = next;
  if (reducedMotion) return;

  // Bar ⇄ panel: the CSS width and body-height transitions carry it (same curve)
  if ((prev === 'bar' && next === 'open') || (prev === 'open' && next === 'bar')) {
    if (next === 'open') zoomIn(bodyEl.value, 60);
    return;
  }

  freeze(true);
  // Rising out of the peek or sinking into it: no clip, so the hover bridge under the chat stays
  // under a pointer resting where the peek is (clipped, it would count as leaving and the chat
  // would bob straight back up). The body's own overflow still hides the panel as it folds
  if (prev === 'peek' || next === 'peek') el.style.overflow = '';
  await nextTick();
  if (token !== morphToken) return;
  applyBodyHeight();
  const to = measure(el);
  const toPeek = next === 'peek';
  morphAnim = el.animate([frame(from), frame(to)], { duration: MORPH_MS, easing: toPeek ? CLOSE_EASE : EASE });
  morphAnim.onfinish = () => {
    morphAnim = undefined;
    freeze(false);
    if (!toPeek) return;
    // Back at rest: the rim and halo drop to the peek's own (CSS) levels, the toast's colour goes
    rimAnim?.cancel();
    haloAnim?.cancel();
    tint.value = null;
  };
  // Rising out of the peek (or sinking back into it) flashes the light
  if (prev === 'peek' || toPeek) light(!toPeek, MORPH_MS, toPeek ? CLOSE_EASE : EASE);
  partsOf(next)
    .filter((part) => part && !before.includes(part))
    .forEach((part) => zoomIn(part, 60));
};

watch(desiredShape, (next) => void morphTo(next));

// A new notice while the toast is already up: swap its contents in place
watch(
  () => notice.value?.id,
  async (id, oldId) => {
    if (!id || !oldId || shape.value !== 'toast' || morphAnim) return;
    tint.value = noticeColor(notice.value!.kind);
    await nextTick();
    if (!reducedMotion) zoomIn(chatEl.value?.querySelector('.chat-toast'), 0);
  },
);

// The halo under the chat and the pill above it follow the chat's box, every frame while it
// morphs and on any resize after (content growing, the window)
let trackUntil = 0;
const syncFrame = () => {
  const el = chatEl.value;
  if (!el || !rootEl.value) return;
  const rect = el.getBoundingClientRect();
  rootEl.value.style.setProperty('--chat-top', `${Math.round(window.innerHeight - rect.top)}px`);
  const halo = haloEl.value;
  if (!halo) return;
  const h = Math.max(rect.height, 8);
  Object.assign(halo.style, {
    left: `${rect.left}px`,
    top: `${rect.bottom - h}px`,
    width: `${rect.width}px`,
    height: `${h}px`,
  });
};
const trackFrame = (ms: number) => {
  const running = performance.now() < trackUntil;
  trackUntil = Math.max(trackUntil, performance.now() + ms);
  if (running) return;
  const tick = () => {
    syncFrame();
    if (performance.now() < trackUntil) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
let resizeObserver: ResizeObserver | undefined;

// ── Notifications ──────────────────────────────────────────────────────────

// The toast, or the pill, opens the panel with today's notifications listed
const openNotifications = () => {
  dropAll();
  notificationCenter.toggleExpanded(true);
  reveal({ focus: false });
  setState('open');
};

const onToastKeydown = (e: KeyboardEvent) => {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  openNotifications();
};

// The toast keeps showing its last notice while it folds away
const toastItem = ref<NotificationItem | null>(null);
watch(notice, (item) => item && (toastItem.value = item), { immediate: true });

const pillItem = computed(() => (state.value !== 'hidden' && shape.value !== 'peek' ? notice.value : null));
const notificationsLabel = computed(() => {
  const n = notifications.value.length;
  return `${n} notification${n === 1 ? '' : 's'} today`;
});

const isEditable = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);

// Open from hover, shortcut or tap. Focus, unless the user is mid-typing in another field
const reveal = ({ focus = true } = {}) => {
  hoverSuppressed = false;
  peekLit.value = false;
  clearTimeout(hoverLeaveTimer); // a pending hover-out must not hide a bar just opened by key or click
  if (state.value === 'hidden') setState(messages.value.length ? 'open' : 'bar');
  const active = document.activeElement as HTMLInputElement | null;
  const busyElsewhere = isEditable(active) && active !== inputEl.value && !!active?.value;
  if (focus && !busyElsewhere) focusInput();
};

// After Esc or a click outside, a pointer still resting on the peek must not pop the bar
// straight back up: hover reveals again only once the pointer has left and come back
let hoverSuppressed = false;

const close = () => {
  hoverSuppressed = true;
  setState(hasDraft.value ? 'bar' : restState());
  if (state.value !== 'open') inputEl.value?.blur();
};

// Hover: the peek lights up at once, and rises after a dwell, so sweeping the mouse along the
// bottom edge doesn't pop it up. Not over the toast: that opens on click
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let hoverLeaveTimer: ReturnType<typeof setTimeout> | undefined;

const onPointerEnter = () => {
  clearTimeout(hoverLeaveTimer);
  if (isTouch || hoverSuppressed || state.value !== 'hidden' || desiredShape.value === 'toast') return;
  peekLit.value = true;
  hoverTimer = setTimeout(() => reveal(), 320);
};

const onPointerLeave = (e: MouseEvent) => {
  clearTimeout(hoverTimer);
  peekLit.value = false;
  const to = e.relatedTarget as Element | null;
  if (!to?.closest('.chat')) hoverSuppressed = false;
  if (isTouch) return;
  hoverLeaveTimer = setTimeout(() => {
    if (state.value === 'bar' && !hasDraft.value && !menuOpen.value) {
      inputEl.value?.blur();
      setState('hidden');
    }
  }, 350);
};

// Click outside closes. Clicks in Vuetify overlays (tooltips, menus, dialogs) and on the pill
// above the chat don't count
const onDocumentPointerDown = (e: PointerEvent) => {
  const target = e.target as Element | null;
  if (!target || chatEl.value?.contains(target) || target.closest('.chat-pill, .v-overlay-container')) return;
  // A confirm toast is answered or dropped: clicking elsewhere dismisses it
  if (state.value === 'hidden') {
    if (shape.value === 'toast' && notice.value?.kind === 'confirm') notificationCenter.dismiss(notice.value.id);
    return;
  }
  if (state.value === 'open' || !hasDraft.value) close();
};

const onDocumentKeydown = (e: KeyboardEvent) => {
  const inChat = !!chatEl.value?.contains(document.activeElement);
  if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    knowsShortcut.value = true;
    reveal();
    return;
  }
  // A / outside any field opens the bar; a second / inside it opens the command menu
  if (e.key === '/' && !inChat && !isEditable(document.activeElement)) {
    e.preventDefault();
    knowsShortcut.value = true;
    reveal();
    return;
  }
  if (e.key === 'Escape' && state.value !== 'hidden' && (inChat || state.value === 'open')) {
    e.preventDefault();
    if (menuOpen.value) menuDismissed.value = true;
    else if (showHistory.value) backToChat();
    else close();
  }
};

const onWindowResize = () => {
  fitBody();
  syncFrame();
};

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('resize', onWindowResize);
  state.value = restState();
  shape.value = desiredShape.value; // the first frame is drawn in place, not morphed
  resizeObserver = new ResizeObserver(syncFrame);
  if (chatEl.value) resizeObserver.observe(chatEl.value);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('resize', onWindowResize);
  clearTimeout(hoverTimer);
  clearTimeout(hoverLeaveTimer);
  resizeObserver?.disconnect();
  stopMorph();
});

// ── Panel height ───────────────────────────────────────────────────────────

const scrollToHighlight = () => historyEl.value?.querySelector('.is-highlighted')?.scrollIntoView({ block: 'nearest' });

// Grow with the content up to 2/3 of the screen (minus the composer), then scroll inside
function applyBodyHeight() {
  const el = bodyEl.value;
  if (!el) return;
  if (shape.value !== 'open') {
    el.style.height = '0px';
    return;
  }
  const inner = showHistory.value ? historyEl.value : threadEl.value;
  if (!inner) return;
  const max = Math.round((window.innerHeight * 2) / 3) - (composerEl.value?.offsetHeight ?? 56);
  inner.style.flex = 'none';
  const natural = (headEl.value?.offsetHeight ?? 0) + (notifsEl.value?.offsetHeight ?? 0) + inner.scrollHeight;
  inner.style.flex = '';
  el.style.height = `${Math.min(natural, max)}px`;
  if (showHistory.value) scrollToHighlight();
  else threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight });
}

let fitFrame = 0;
function fitBody() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    applyBodyHeight();
    trackFrame(MORPH_MS + 60); // the body-height transition moves the pill and halo
  });
}

watch(
  [shape, showHistory, messages, isLoading, error, historyIndex, conversations, notifications, notificationsExpanded],
  () => void nextTick(fitBody),
  { flush: 'post' },
);

// Keep the newest message in view once the height animation settles
const onBodyTransitionEnd = (e: TransitionEvent) => {
  if (e.propertyName === 'height' && !showHistory.value) threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight });
};


</script>

<template>
  <div
    ref="rootEl"
    class="chat-bar"
    :class="{
      'is-peek': shape === 'peek',
      'is-lit': peekLit,
      'is-toast': shape === 'toast',
      'is-open': shape === 'open',
      'has-rail': mdAndUp,
    }"
    :style="lightStyle"
  >
    <!-- Glow under the chat while it morphs; a sibling, so the chat's solid surface doesn't cover it -->
    <div ref="haloEl" class="chat-halo" aria-hidden="true" />

    <!-- The chat: toast, or conversation panel above the composer -->
    <div
      ref="chatEl"
      class="chat"
      role="dialog"
      aria-label="Chat"
      @mouseenter="onPointerEnter"
      @mouseleave="onPointerLeave"
    >
      <div ref="rimEl" class="chat-rim" aria-hidden="true" />

      <!-- At rest: only the composer's top edge shows above the bottom of the screen (the rest of
           it sits below); the whole edge is the click target -->
      <button v-if="shape === 'peek'" type="button" class="chat-peek" aria-label="Open chat" @click="reveal()" />

      <!-- Notification toast (chat hidden): opens the panel with the list -->
      <div
        v-if="shape === 'toast'"
        class="chat-toast"
        role="status"
        tabindex="0"
        aria-label="Notifications"
        @click="openNotifications"
        @keydown="onToastKeydown"
      >
        <ChatNotice v-if="toastItem" :key="toastItem.id" :item="toastItem" variant="toast" />
      </div>

      <div v-show="shape !== 'toast'" ref="bodyEl" class="chat-body" @transitionend="onBodyTransitionEnd">
        <!-- Header: conversation title, history and new chat -->
        <div ref="headEl" class="chat-head">
          <span class="chat-title">{{ title }}</span>
          <button
            type="button"
            class="chat-iconbtn"
            :aria-pressed="showHistory"
            aria-label="History"
            title="History"
            @click="toggleHistory"
          >
            <VIcon icon="mdi-history" size="18" />
          </button>
          <button
            type="button"
            class="chat-iconbtn"
            aria-label="New chat"
            title="New chat"
            :disabled="isLoading"
            @click="newChat"
          >
            <VIcon icon="mdi-plus" size="18" />
          </button>
        </div>

        <!-- Today's notifications: a row that expands into the list -->
        <div v-if="notifications.length && shape === 'open'" ref="notifsEl" class="chat-notifs">
          <button
            type="button"
            class="notif-row"
            :aria-expanded="notificationsExpanded"
            @click="notificationCenter.toggleExpanded()"
          >
            <VIcon icon="mdi-bell-outline" size="17" />
            <span>{{ notificationsLabel }}</span>
            <VIcon icon="mdi-chevron-down" size="18" class="notif-chevron" />
          </button>
          <div v-if="notificationsExpanded" class="notif-list chat-scroll">
            <ChatNotice v-for="item in notifications" :key="item.id" :item="item" variant="row" />
          </div>
        </div>

        <!-- Conversation -->
        <div
          v-show="!showHistory"
          ref="threadEl"
          class="chat-thread chat-scroll"
          :class="{ 'drag-over': isDragOver }"
          aria-live="polite"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <div v-if="!messages.length && !error && !isCatchUpLoading && !isTouch" class="chat-msg is-ai">
            Open this anytime with <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd>.
          </div>

          <AiChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            :is-saveable="msg.id === latestLogsMessageId"
            :is-undoable="msg.metadata?.saveState === 'saved' && msg.id === savedLogsMessageId"
            :can-retry="msg.id === lastUserMessageId && !!error"
            @save-logs="(logs) => saveLogs(msg.id, logs)"
            @undo="() => undoLogs(msg.id)"
            @discard="() => markDiscarded(msg.id)"
            @retry="() => retry(msg.id)"
          />

          <!-- Thinking -->
          <div v-if="isLoading || isCatchUpLoading" class="chat-msg is-ai" aria-label="Thinking">
            <span class="chat-dots"><i /><i /><i /></span>
          </div>

          <!-- Error -->
          <div v-if="error" class="chat-msg is-error">
            <span v-if="isConfigError">
              AI Assistant is not set up. Choose how it should run in
              <a class="chat-link" href="/setting" @click.prevent="openSettings">Settings</a>.
            </span>
            <template v-else>
              <span class="flex-grow-1">{{ error }}</span>
              <button type="button" class="chat-iconbtn is-small" aria-label="Dismiss" @click="error = null">
                <VIcon icon="mdi-close" size="16" />
              </button>
            </template>
          </div>
        </div>

        <!-- History: one-line pills on a single timeline, oldest at the top -->
        <div v-show="showHistory" ref="historyEl" class="chat-history chat-scroll" aria-label="Chat history">
          <div v-if="!historyRows.length" class="history-day is-empty">No chats yet</div>
          <template v-for="row in historyRows" :key="row.conversation.id">
            <div v-if="row.showDay" class="history-day">{{ row.day }}</div>
            <div class="history-node" :style="{ '--node-color': `var(--v-theme-${row.color})` }">
              <button
                type="button"
                class="history-pill"
                :class="{
                  'is-current': row.conversation.id === currentId,
                  'is-highlighted': row.index === historyIndex,
                }"
                @click="openConversation(row.conversation)"
              >
                <span
                  v-if="row.commandDef"
                  class="command-chip"
                  :style="{ '--chip-color': `var(--v-theme-${row.commandDef.color})` }"
                >
                  <VIcon :icon="row.commandDef.icon" size="14" />/{{ row.commandDef.name }}
                </span>
                <span class="history-text">{{ row.conversation.title }}</span>
                <time>{{ dayjs(row.conversation.updatedAt).format('HH:mm') }}</time>
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Above the composer, until learned: how to open the bar -->
      <div v-if="!knowsShortcut && !isTouch && shape === 'bar'" class="chat-tip">
        <VIcon icon="mdi-keyboard-outline" size="16" />
        <span>Tip: press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to open this anytime</span>
      </div>

      <!-- Composer -->
      <div v-show="shape !== 'toast'" ref="composerEl" class="chat-composer" @dragover.prevent="isDragOver = true" @drop.prevent="onDrop">
        <!-- Slash command menu, rising above the bar -->
        <div v-if="menuOpen" class="chat-menu" role="listbox" aria-label="Commands" @mousedown.prevent>
          <button
            v-for="(cmd, i) in suggestions"
            :key="cmd.name"
            type="button"
            role="option"
            :aria-selected="i === menuIndex"
            :class="{ 'is-active': i === menuIndex }"
            :style="{ '--chip-color': `var(--v-theme-${cmd.color})` }"
            @mousemove="menuIndex = i"
            @click="pickCommand(cmd)"
          >
            <VIcon :icon="cmd.icon" size="18" class="menu-icon" />
            <b>/{{ cmd.name }}</b>
            <span>{{ cmd.hint }}</span>
            <span v-if="i === menuIndex" class="menu-key">Enter</span>
          </button>
        </div>

        <!-- Attached screenshot -->
        <div v-if="attachedPreview" class="chat-attachment">
          <img :src="attachedPreview" alt="Attached image" />
          <button type="button" class="chat-iconbtn is-small" aria-label="Remove image" @click="removeAttachment">
            <VIcon icon="mdi-close" size="14" />
          </button>
        </div>

        <div class="composer-row">
          <VIcon icon="mdi-creation-outline" size="18" class="composer-spark" />
          <span
            v-if="command"
            class="command-chip composer-chip"
            :style="{ '--chip-color': `var(--v-theme-${command.color})` }"
          >
            <VIcon :icon="command.icon" size="14" />/{{ command.name }}
          </span>
          <textarea
            ref="inputEl"
            v-model="inputText"
            rows="1"
            :placeholder="placeholder"
            aria-label="Message"
            @keydown="onKeydown"
            @paste="onPaste"
            @focus="state === 'hidden' && reveal({ focus: false })"
          />
          <input
            ref="fileInputEl"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="d-none"
            @change="onFileSelect"
          />
          <button
            type="button"
            class="chat-iconbtn"
            aria-label="Attach image"
            title="Attach image"
            @click="fileInputEl?.click()"
          >
            <VIcon icon="mdi-image-outline" size="18" />
          </button>
          <button
            v-if="hasDraft"
            type="button"
            class="chat-iconbtn"
            aria-label="Clear text"
            title="Clear"
            @click="clearDraft"
          >
            <VIcon icon="mdi-close" size="18" />
          </button>
          <button type="button" class="chat-send" aria-label="Send" :disabled="!canSend" @click="send">
            <VIcon icon="mdi-arrow-up" size="20" />
          </button>
        </div>
      </div>
    </div>

    <!-- Something happened while the chat is in use: a pill just above it, never in the chat -->
    <Transition name="chat-pill">
      <div
        v-if="pillItem"
        :key="pillItem.id"
        class="chat-pill"
        role="status"
        aria-label="Notification"
        @click="openNotifications"
      >
        <ChatNotice :item="pillItem" variant="pill" />
      </div>
    </Transition>
  </div>
</template>

<style>
/* Surface tokens for the bar. Solid, no glass: the coloured rim already sets it apart, and the
   grey glass blended into the grey background (the peek edge most of all). Light is white; dark
   is a step lighter than the cards, since lighter reads as a higher layer there where shadows
   barely show. AI bubbles take a faint tint to show on it. The rim light comes from the bottom
   right in light and the top left in dark. Shared by AiChatMessage, which renders inside the bar. */
.chat-bar {
  /* Everything centres on the content area, right of the nav rail on md and up */
  --inset-l: 12px;
  --content-x: calc(50% + (var(--inset-l) - 12px) / 2);
  --content-w: calc(100vw - var(--inset-l) - 12px);
  --chat-veil: #ffffff;
  --chat-rim:
    inset -1.5px -1.5px 1px -0.5px rgba(255, 255, 255, 0.95), inset 1px 1px 0 0 rgba(20, 28, 38, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  --chat-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.07), 0 24px 60px rgba(0, 0, 0, 0.08);
  --chat-line: rgba(20, 28, 38, 0.12);
  --chat-tile: rgba(20, 28, 38, 0.05);
  --chat-menu: rgba(255, 255, 255, 0.94);
  --chat-ai: rgba(20, 28, 38, 0.05);
  --chat-halo: rgba(255, 255, 255, 0.75);
  --chat-thumb: rgba(20, 28, 38, 0.22);
  --chat-thumb-hover: rgba(20, 28, 38, 0.36);
  /* The light ("pha màu"): a near-black core (white in dark) running through blue, pink and
     amber on the rim; the glow under it runs the whole spectrum. Notifications swap in their own
     colour (lightStyle). The rim's angle turns on the rim itself, so it takes stops, not a gradient */
  --light-mono: rgba(16, 18, 22, 0.8);
  --halo-grad: linear-gradient(90deg, #6f9bff, #a98bff, #ff7eb6, #ffad66, #6fdcc0);
  --rim-stops: var(--light-mono), #6f9bff, var(--light-mono) 35%, #ff7eb6 55%, var(--light-mono) 70%, #ffad66 85%,
    var(--light-mono);
}

.chat-bar.has-rail {
  --inset-l: 92px;
}

.v-theme--dark .chat-bar {
  --chat-veil: #363636;
  --chat-rim:
    inset 1.5px 1.5px 1px -0.5px rgba(255, 255, 255, 0.45), inset -1px -1px 0 0 rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  --chat-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.22), 0 24px 60px rgba(0, 0, 0, 0.24);
  --chat-line: rgba(232, 236, 239, 0.12);
  --chat-tile: rgba(255, 255, 255, 0.05);
  --chat-menu: #404040;
  --chat-ai: rgba(255, 255, 255, 0.07);
  --chat-halo: rgba(20, 22, 26, 0.7);
  --chat-thumb: rgba(255, 255, 255, 0.2);
  --chat-thumb-hover: rgba(255, 255, 255, 0.34);
  --light-mono: rgba(255, 255, 255, 0.85);
}

/* Thin themed scrollbars (Vuetify 3 has no scroll-area component) */
.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--chat-thumb) transparent;
}
.chat-scroll::-webkit-scrollbar {
  width: 8px;
}
.chat-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.chat-scroll::-webkit-scrollbar-thumb {
  background: var(--chat-thumb);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.chat-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--chat-thumb-hover);
}

/* Message bubbles, shared with AiChatMessage */
.chat-msg {
  max-width: 86%;
  padding: 8px 12px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
  animation: chat-line-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.chat-msg.is-me {
  align-self: flex-end;
  background: rgba(var(--v-theme-primary), 0.14);
  border-bottom-right-radius: 6px;
}
.chat-msg.is-ai {
  align-self: flex-start;
  background: var(--chat-ai);
  border-bottom-left-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.chat-msg.is-error {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--v-theme-error), 0.14);
  color: rgb(var(--v-theme-error));
  border-bottom-left-radius: 6px;
}
@keyframes chat-line-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

/* Tonal chip in the command's own hue. Own markup (not VChip) so the icon sits on the text's
   centre line: VChip's x-small prepend icon rides high */
.command-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px 0 6px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  flex: none;
  color: rgb(var(--chip-color));
  background: rgba(var(--chip-color), 0.14);
}

.chat-bar kbd {
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--chat-line);
  background: var(--chat-tile);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

@media (prefers-reduced-motion: reduce) {
  .chat-msg {
    animation: none;
  }
}
</style>

<style scoped>
/* Rim: a 2px ring of turning light (the border box minus the padding box), bright while the
   chat rises out of the peek and quiet after */
.chat-rim {
  position: absolute;
  inset: 0;
  z-index: 3;
  padding: 2px;
  border-radius: inherit;
  background: conic-gradient(from var(--a), var(--rim-stops));
  opacity: 0.75;
  pointer-events: none;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  animation: chat-light-turn 9s linear infinite;
}
.chat-bar.is-peek:not(.is-lit) .chat-rim {
  animation-play-state: paused;
}
@property --a {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes chat-light-turn {
  to {
    --a: 360deg;
  }
}

/* Halo: the same light, blurred, under the chat while it morphs; at rest the surface stays neutral
   and only the rim is coloured. syncFrame keeps it on the chat's box */
.chat-halo {
  position: fixed;
  z-index: 1006;
  border-radius: 999px;
  background: var(--halo-grad);
  filter: blur(18px);
  opacity: 0;
  pointer-events: none;
}
.chat-bar.is-peek .chat-halo {
  opacity: 0;
}

/* ── The chat ── */
.chat {
  --w: 560px;
  position: fixed;
  z-index: 1007;
  left: var(--content-x);
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  width: min(var(--w), calc(var(--content-w) - 20px));
  transform: translate(-50%, 0);
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* while it morphs (clipped), the bottom stays in view */
  border-radius: 30px;
  color: rgb(var(--v-theme-on-surface));
  background: var(--chat-veil);
  box-shadow: var(--chat-rim), var(--chat-shadow);
  transition:
    width 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
/* Hover bridge from the risen chat down to the screen edge: a pointer still where the peek was
   (now in the gap under the bar) hasn't left, so the bar doesn't sink back under it */
.chat::after {
  content: '';
  position: absolute;
  inset: 100% 0 auto;
  height: calc(16px + env(safe-area-inset-bottom, 0px));
}
.chat-bar.is-open .chat {
  --w: 640px;
  border-radius: 26px;
}
.chat-bar.is-toast .chat {
  --w: 400px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-radius: 23px;
}
/* Peek (the rest state with a mouse): the bar's own box sunk below the screen edge, so only an
   edge of it (--peek-h, inside the 12px bottom gutter) shows. It overlays the page: nothing makes
   room for it. Its composer stays underneath, invisible, so the box keeps the bar's size and
   rising is a plain slide. Hover lifts it a little while the dwell runs */
.chat-bar.is-peek .chat {
  --peek-h: 10px;
  --bar-h: 56px;
  height: var(--bar-h);
  bottom: calc(var(--peek-h) - var(--bar-h));
  transition: bottom 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-bar.is-peek.is-lit .chat {
  bottom: calc(var(--peek-h) + 4px - var(--bar-h));
}
.chat-bar.is-peek .chat-rim {
  opacity: 0.7;
  transition: opacity 0.3s;
}
/* On white the edge needs the rim at full strength to catch the eye */
.v-theme--light .chat-bar.is-peek .chat-rim {
  opacity: 1;
}
.chat-bar.is-peek.is-lit .chat-rim {
  opacity: 1;
}
.chat-bar.is-peek .chat-composer {
  opacity: 0;
  pointer-events: none;
}
.chat > :not(.chat-rim) {
  transition: opacity 0.15s ease-out;
}

.chat-peek {
  position: absolute;
  inset: 0 0 auto;
  z-index: 2;
  height: var(--peek-h);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  outline: none;
}
.chat-peek:focus-visible {
  background: var(--chat-tile);
}

/* Toast: one line, 46px tall */
.chat-toast {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 8px 0 16px;
  cursor: pointer;
  outline: none;
  text-shadow: 0 0 6px var(--chat-halo);
}
.chat-toast > * {
  flex: 1;
}

/* Pill above the open chat (--chat-top is the chat's top edge, from syncFrame) */
.chat-pill {
  position: fixed;
  z-index: 1008;
  left: var(--content-x);
  bottom: calc(var(--chat-top, 72px) + 10px);
  max-width: calc(var(--content-w) - 20px);
  height: 38px;
  display: flex;
  align-items: center;
  padding: 0 6px 0 14px;
  border-radius: 19px;
  transform: translateX(-50%);
  color: rgb(var(--v-theme-on-surface));
  background: var(--chat-veil);
  box-shadow: var(--chat-rim), 0 8px 24px rgba(0, 0, 0, 0.14);
  cursor: pointer;
}
.chat-pill-enter-active {
  transition:
    opacity 0.36s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.36s cubic-bezier(0.32, 0.72, 0, 1),
    filter 0.36s cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-pill-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
}
.chat-pill-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.9);
  filter: blur(4px);
}
.chat-pill-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px) scale(0.94);
}

/* Today's notifications, at the top of the panel */
.chat-notifs {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 14px 2px;
}
.notif-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--chat-tile);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 12px;
  cursor: pointer;
}
.notif-row:hover {
  color: rgb(var(--v-theme-on-surface));
}
.notif-chevron {
  margin-left: auto;
  transition: transform 0.25s;
}
.notif-row[aria-expanded='true'] .notif-chevron {
  transform: rotate(180deg);
}
.notif-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 30vh;
  overflow-y: auto;
  animation: chat-notifs-in 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}
@keyframes chat-notifs-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

/* Conversation panel: height set by fitBody (content, capped at 2/3 of the screen) */
.chat-body {
  height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}

.chat-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px 2px 18px;
  flex: none;
}
.chat-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0 6px var(--chat-halo);
}

.chat-iconbtn {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
}
.chat-iconbtn:hover:not(:disabled) {
  background: var(--chat-tile);
  color: rgb(var(--v-theme-on-surface));
}
.chat-iconbtn:disabled {
  opacity: 0.4;
  cursor: default;
}
.chat-iconbtn[aria-pressed='true'] {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.chat-iconbtn.is-small {
  width: 24px;
  height: 24px;
  border-radius: 12px;
}

.chat-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chat-thread.drag-over {
  background: rgba(var(--v-theme-primary), 0.08);
}

.chat-dots {
  display: inline-flex;
  gap: 4px;
  padding: 6px 2px;
}
.chat-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.35;
  animation: chat-dot 1s infinite;
}
.chat-dots i:nth-child(2) {
  animation-delay: 0.15s;
}
.chat-dots i:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes chat-dot {
  30% {
    opacity: 1;
  }
}

.chat-link {
  color: inherit;
  font-weight: 600;
  text-underline-offset: 2px;
}

/* ── History timeline: one rail through day labels and pills ── */
.chat-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 14px 10px 18px;
  display: flex;
  flex-direction: column;
}
.history-day,
.history-node {
  position: relative;
  padding-left: 22px;
}
.history-day::before,
.history-node::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 0;
  bottom: 0; /* segments meet edge to edge: an overlap shows as a darker dot on the translucent line */
  width: 2px;
  background: var(--chat-line);
}
.history-day:first-child::before {
  top: 50%;
}
.history-node:last-child::before {
  bottom: 50%;
}
.history-day {
  padding-top: 8px;
  padding-bottom: 4px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}
.history-day.is-empty::before {
  display: none;
}
.history-node {
  display: flex;
  align-items: center;
  min-width: 0;
  padding-block: 1px;
}
.history-node::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border-radius: 50%;
  background: rgb(var(--node-color));
}
.history-pill {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--chat-ai);
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.history-pill:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}
.history-pill.is-current {
  box-shadow: inset 0 0 0 1.5px rgba(var(--v-theme-primary), 0.6);
}
.history-pill.is-highlighted {
  background: rgba(var(--v-theme-primary), 0.16);
}
.history-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-pill time {
  flex: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

/* Shortcut tip: a quiet line above the composer */
.chat-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px 0;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-shadow: 0 0 6px var(--chat-halo);
}
/* ── Composer ── */
.chat-composer {
  position: relative;
  padding: 8px 8px 8px 14px;
  text-shadow:
    0 0 6px var(--chat-halo),
    0 0 2px var(--chat-halo);
}
.chat-bar.is-open .chat-composer {
  border-top: 1px solid var(--chat-line);
}
.composer-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-height: 40px;
}
.composer-spark {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin: 0 4px 11px 0;
}
.composer-chip {
  margin: 0 2px 9px 0;
}
.chat-composer textarea {
  flex: 1;
  min-width: 0;
  height: 21px;
  max-height: 105px;
  margin: 0 4px 10px;
  padding: 0;
  border: 0;
  outline: none;
  resize: none;
  overflow-y: auto;
  scrollbar-width: none;
  background: none;
  color: inherit;
  font: 15px/21px inherit;
  font-family: inherit;
  caret-color: rgb(var(--v-theme-primary));
}
.chat-composer textarea::placeholder {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.composer-row .chat-iconbtn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
}
.chat-send {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 20px;
  /* Ink rather than brand green: dark in light mode, white in dark mode, so green stays rare */
  background: rgb(var(--v-theme-on-surface));
  color: rgb(var(--v-theme-surface));
  cursor: pointer;
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.chat-send:disabled {
  opacity: 0.35;
  cursor: default;
}
.chat-send:not(:disabled):hover {
  transform: scale(1.05);
}

.chat-attachment {
  position: relative;
  width: fit-content;
  margin: 0 0 6px 28px;
}
.chat-attachment img {
  display: block;
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 10px;
}
.chat-attachment .chat-iconbtn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--chat-menu);
}

/* Slash menu: a sheet that rises above the bar */
.chat-menu {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(100% + 8px);
  display: grid;
  gap: 2px;
  padding: 6px;
  border-radius: 18px;
  background: var(--chat-menu);
  box-shadow:
    var(--chat-rim),
    0 10px 30px rgba(0, 0, 0, 0.14);
  text-shadow: none;
  transform-origin: 50% 100%;
  animation: chat-menu-rise 0.3s cubic-bezier(0.4, 1.02, 0.5, 1);
}
.chat-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.chat-menu button.is-active {
  background: var(--chat-tile);
}
.chat-menu .menu-icon,
.chat-menu b {
  color: rgb(var(--chip-color));
}
.chat-menu b {
  font-weight: 500;
}
.chat-menu span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.chat-menu .menu-key {
  margin-left: auto;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}
@keyframes chat-menu-rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat,
  .chat-body,
  .chat-seam::before,
  .chat-seam::after,
  .chat-pill-enter-active,
  .chat-pill-leave-active {
    transition: none !important;
  }
  .chat-menu,
  .chat-dots i,
  .chat-rim,
  .notif-list {
    animation: none;
  }
}
</style>
