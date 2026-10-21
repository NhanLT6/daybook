import { onBeforeUnmount, type Ref, watch } from 'vue';

/**
 * Marks every match of `query` inside `container` with the CSS Custom Highlight API: no <mark> elements,
 * so rendered rich text (v-html, drag-and-drop nodes) is never rewritten. Style it with
 * `::highlight(<name>)` in a global stylesheet. Browsers without the API simply show no highlight.
 *
 * Matches within one text node only: a word split by formatting ("foo<b>bar</b>") still filters but isn't marked.
 */
export function useSearchHighlight(
  container: Ref<HTMLElement | null>,
  query: Ref<string>,
  name: string,
  // Anything whose change re-renders the container (e.g. the shown items)
  source?: Ref<unknown>,
) {
  const supported = typeof CSS !== 'undefined' && 'highlights' in CSS;

  const paint = () => {
    if (!supported) return;
    const needle = query.value.trim().toLowerCase();
    const root = container.value;
    if (!needle || !root) {
      CSS.highlights.delete(name);
      return;
    }

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase() ?? '';
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
        const range = new Range();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        ranges.push(range);
      }
    }
    CSS.highlights.set(name, new Highlight(...ranges));
  };

  // After the DOM has updated, so the walk sees the filtered cards
  watch([query, container, () => source?.value], paint, { flush: 'post', immediate: true });

  onBeforeUnmount(() => {
    if (supported) CSS.highlights.delete(name);
  });
}
