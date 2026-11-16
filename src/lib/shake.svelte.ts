// Shake detection from the devicemotion event, feature-detected rather than OS-sniffed.

type Status =
	| 'idle' // not asked yet
	| 'checking' // listening, waiting for the first real sensor reading
	| 'on' // sensor data is arriving
	| 'denied' // iOS permission refused; cannot be re-asked until the app restarts
	| 'unavailable'; // no sensor (desktop), or blocked

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

const GRAVITY = 9.81;
/** Movement beyond gravity, in m/s², that counts as shaking. Lifting the phone stays well under this. */
const THRESHOLD = 14;
/** A shake swings back and forth, so require two hard readings close together. */
const PAIR_WINDOW_MS = 500;
const COOLDOWN_MS = 1000;
/** Desktop browsers expose the event but never fire it with data. */
const PROBE_MS = 1000;

class Shake {
	status = $state<Status>('idle');
	/** Called on every detected shake. */
	onshake: (() => void) | null = null;

	#lastHard = 0;
	#lastShake = 0;

	/**
	 * Starts listening. Must be called directly from a tap handler, before any await,
	 * because iOS only shows the motion permission prompt from a user gesture.
	 */
	start() {
		if (this.status !== 'idle') return;
		if (typeof DeviceMotionEvent === 'undefined') {
			this.status = 'unavailable';
			return;
		}
		const request = (DeviceMotionEvent as unknown as PermissionRequester).requestPermission;
		if (typeof request === 'function') {
			this.status = 'checking';
			request.call(DeviceMotionEvent).then(
				(answer) => (answer === 'granted' ? this.#listen() : (this.status = 'denied')),
				() => (this.status = 'unavailable')
			);
		} else {
			this.#listen();
		}
	}

	#listen() {
		this.status = 'checking';
		window.addEventListener('devicemotion', this.#onMotion);
		setTimeout(() => {
			if (this.status === 'checking') {
				this.status = 'unavailable';
				window.removeEventListener('devicemotion', this.#onMotion);
			}
		}, PROBE_MS);
	}

	#onMotion = (event: DeviceMotionEvent) => {
		// Vector magnitude, so axis orientation and sign conventions do not matter.
		const magnitude = (a: DeviceMotionEventAcceleration | null) =>
			a && a.x !== null && a.y !== null && a.z !== null ? Math.hypot(a.x, a.y, a.z) : null;

		const linear = magnitude(event.acceleration);
		const withGravity = magnitude(event.accelerationIncludingGravity);
		const force = linear ?? (withGravity === null ? null : Math.abs(withGravity - GRAVITY));
		if (force === null) return;
		this.status = 'on';

		if (force < THRESHOLD) return;
		const now = performance.now();
		const paired = now - this.#lastHard < PAIR_WINDOW_MS;
		this.#lastHard = now;
		if (paired && now - this.#lastShake > COOLDOWN_MS) {
			this.#lastShake = now;
			this.onshake?.();
		}
	};
}

export const shake = new Shake();
