// Typing that leaves no undo history, so shaking the phone never offers "Undo Typing".
//
// iOS shows that prompt on a shake whenever the page has typing to undo. A page cannot turn
// the prompt off, and WebKit keeps the history for the whole page, so replacing the text box
// does not clear it. The way around it is to never make any: each edit is caught before the
// browser applies it and is applied by script instead, which the browser does not record.
//
// Edits that cannot be cancelled (composing with an input method, for Chinese or Japanese)
// and replacements whose range is unknown are left to the browser.

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const words = new Intl.Segmenter(undefined, { granularity: 'word' });

/** Where the grapheme before (or after) `at` starts (or ends), so an emoji goes in one delete. */
function graphemeEdge(value: string, at: number, forward: boolean): number {
	let edge = forward ? value.length : 0;
	for (const { index, segment } of graphemes.segment(value)) {
		const end = index + segment.length;
		if (forward && index >= at) return end;
		if (!forward && end >= at) return index;
		edge = forward ? end : index;
	}
	return edge;
}

/** Where the word before (or after) `at` starts (or ends), skipping spaces next to it. */
function wordEdge(value: string, at: number, forward: boolean): number {
	const segments = [...words.segment(value)];
	if (forward) {
		const next = segments.find((s) => s.index + s.segment.length > at && s.isWordLike);
		return next ? next.index + next.segment.length : value.length;
	}
	const previous = segments.findLast((s) => s.index < at && s.isWordLike);
	return previous ? previous.index : 0;
}

/** The text an insertion brings. */
const inserted = (event: InputEvent) => event.data ?? event.dataTransfer?.getData('text/plain') ?? '';

export function noUndo(node: HTMLTextAreaElement | HTMLInputElement) {
	function onBeforeInput(e: Event) {
		const event = e as InputEvent;
		if (event.isComposing || !event.cancelable) return;
		const value = node.value;
		const from = node.selectionStart ?? value.length;
		const to = node.selectionEnd ?? from;
		const selected = from !== to;
		let start = from;
		let end = to;
		let text = '';

		switch (event.inputType) {
			case 'insertText':
			case 'insertFromPaste':
			case 'insertFromDrop':
			case 'insertFromYank':
				text = inserted(event);
				break;
			case 'insertReplacementText':
				// Autocorrect and suggestions name the word they replace only as a range, which
				// text boxes do not expose. Without it, the browser has to do it.
				if (!selected) return;
				text = inserted(event);
				break;
			case 'deleteContentBackward':
				if (!selected) start = graphemeEdge(value, from, false);
				break;
			case 'deleteContentForward':
				if (!selected) end = graphemeEdge(value, to, true);
				break;
			case 'deleteWordBackward':
				if (!selected) start = wordEdge(value, from, false);
				break;
			case 'deleteWordForward':
				if (!selected) end = wordEdge(value, to, true);
				break;
			case 'deleteSoftLineBackward':
			case 'deleteHardLineBackward':
				if (!selected) start = 0;
				break;
			case 'deleteSoftLineForward':
			case 'deleteHardLineForward':
				if (!selected) end = value.length;
				break;
			case 'deleteEntireSoftLine':
				start = 0;
				end = value.length;
				break;
			case 'deleteByCut':
			case 'deleteByDrag':
			case 'deleteContent':
				break;
			case 'insertLineBreak':
			case 'insertParagraph':
			case 'historyUndo':
			case 'historyRedo':
				// One line only, and nothing to undo.
				event.preventDefault();
				return;
			default:
				return;
		}

		event.preventDefault();
		if (start === end && text === '') return;
		node.setRangeText(text, start, end, 'end');
		// Script changes fire no input event of their own; bound values listen for one.
		node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: event.inputType, data: event.data }));
	}

	// Safari's autocorrect replaces words in a way that cannot be taken over (see above).
	node.setAttribute('autocorrect', 'off');
	node.addEventListener('beforeinput', onBeforeInput);
	return () => node.removeEventListener('beforeinput', onBeforeInput);
}
