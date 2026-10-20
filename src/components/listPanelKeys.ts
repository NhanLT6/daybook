import type { InjectionKey, Ref } from 'vue';

// ListPanel → GroupedTable: whether the list body has scrolled (the pinned column titles take a fill)
export const LIST_SCROLLED_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('listScrolled');
