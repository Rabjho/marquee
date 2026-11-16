// Keeps the screen on while the sign plays. The browser drops the lock whenever the
// page is hidden, so it is taken again when the page comes back.

let wanted = false;
let lock: WakeLockSentinel | null = null;

async function acquire() {
	if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
	try {
		const taken = await navigator.wakeLock.request('screen');
		taken.addEventListener('release', () => {
			if (lock === taken) lock = null;
		});
		if (wanted) lock = taken;
		else void taken.release();
	} catch {
		// Refused (low battery, unsupported): the sign still plays, the screen may just dim.
	}
}

export function keepAwake(on: boolean) {
	wanted = on;
	if (on) {
		void acquire();
	} else {
		void lock?.release();
		lock = null;
	}
}

if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => void acquire());
}
