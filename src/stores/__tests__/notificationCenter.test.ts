import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPinia, setActivePinia } from 'pinia';

import { useNotificationCenterStore } from '@/stores/notificationCenter';

describe('notificationCenter store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    useNotificationCenterStore().clear();
    vi.useRealTimers();
  });

  it('enqueues and dismisses notifications', () => {
    const store = useNotificationCenterStore();

    const id = store.enqueue({ kind: 'success', title: 'Log saved' });

    expect(store.queueCount).toBe(1);
    expect(store.activeItem?.id).toBe(id);

    store.dismiss(id);

    expect(store.queueCount).toBe(0);
    expect(store.activeItem).toBeNull();
  });

  it('supports shorthand methods over enqueue', () => {
    const store = useNotificationCenterStore();

    const id = store.success('Saved', { message: 'One log added' });

    expect(store.activeItem?.id).toBe(id);
    expect(store.activeItem?.kind).toBe('success');
    expect(store.activeItem?.title).toBe('Saved');
    expect(store.activeItem?.message).toBe('One log added');
  });

  it('auto-dismisses passive notifications', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'success', title: 'Saved', autoDismissMs: 100 });
    vi.advanceTimersByTime(100);

    expect(store.queueCount).toBe(0);
  });

  it('uses a 3 second default for success notifications', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'success', title: 'Saved' });
    vi.advanceTimersByTime(2999);
    expect(store.queueCount).toBe(1);

    vi.advanceTimersByTime(1);
    expect(store.queueCount).toBe(0);
  });

  it('keeps confirm notifications persistent', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'confirm', title: 'Delete log?' });
    vi.advanceTimersByTime(30_000);

    expect(store.queueCount).toBe(1);
  });

  it('keeps confirm notifications persistent even if a caller passes passive options', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'confirm', title: 'Delete log?', persistent: false, autoDismissMs: 100 });
    vi.advanceTimersByTime(100);

    expect(store.queueCount).toBe(1);
  });

  it('keeps actionable notifications persistent even if a caller passes passive options', () => {
    const store = useNotificationCenterStore();

    store.enqueue({
      kind: 'info',
      title: 'Action needed',
      persistent: false,
      autoDismissMs: 100,
      actions: [{ id: 'open', label: 'Open' }],
    });
    vi.advanceTimersByTime(100);

    expect(store.queueCount).toBe(1);
  });

  it('opens the island when a confirm notification is enqueued', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'confirm', title: 'Delete log?' });

    expect(store.isExpanded).toBe(true);
  });

  it.each(['greeting', 'warning', 'error'] as const)(
    'opens the island when a %s notification is enqueued',
    (kind) => {
      const store = useNotificationCenterStore();

      store.enqueue({ kind, title: 'Test' });

      expect(store.isExpanded).toBe(true);
    },
  );

  it('opens the island when expandOnEnqueue is true regardless of kind', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'info', title: 'New Update', expandOnEnqueue: true });

    expect(store.isExpanded).toBe(true);
  });

  it('does not open the island for passive kinds without expandOnEnqueue', () => {
    const store = useNotificationCenterStore();

    store.enqueue({ kind: 'info', title: 'FYI' });

    expect(store.isExpanded).toBe(false);
  });

  it('runs actions and closes items on completion', async () => {
    const store = useNotificationCenterStore();
    const onClick = vi.fn();

    const id = store.enqueue({
      kind: 'confirm',
      title: 'Delete log?',
      actions: [{ id: 'delete', label: 'Delete', closeOnComplete: true, onClick }],
    });

    await store.runAction(id, 'delete');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(store.queueCount).toBe(0);
  });

  it('collapses after a completed confirm action unless another confirm remains active', async () => {
    const store = useNotificationCenterStore();
    store.enqueue({ kind: 'info', title: 'Background item', autoDismissMs: 60_000 });
    const id = store.enqueue({
      kind: 'confirm',
      title: 'Delete log?',
      actions: [{ id: 'cancel', label: 'Cancel', closeOnComplete: true }],
    });

    await store.runAction(id, 'cancel');

    expect(store.queueCount).toBe(1);
    expect(store.activeItem?.kind).toBe('info');
    expect(store.isExpanded).toBe(false);
  });

  it('tracks async action loading state', async () => {
    const store = useNotificationCenterStore();
    let resolveAction: () => void = () => {};

    const id = store.enqueue({
      kind: 'confirm',
      title: 'Delete log?',
      actions: [
        {
          id: 'delete',
          label: 'Delete',
          closeOnComplete: true,
          onClick: () =>
            new Promise<void>((resolve) => {
              resolveAction = resolve;
            }),
        },
      ],
    });

    const run = store.runAction(id, 'delete');
    expect(store.isActionLoading(id, 'delete')).toBe(true);

    resolveAction();
    await run;

    expect(store.isActionLoading(id, 'delete')).toBe(false);
  });
});
