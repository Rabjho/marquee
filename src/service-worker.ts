// Offline support: the whole app is precached on install and served cache-first.

import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `marquee-${version}`;
// Paths come without a leading slash, and the home page is the empty string.
const FILES = [...immutable, ...assets, ...prerendered]
	.filter((file) => file.path !== '_headers')
	.map((file) => `./${file.path}`);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(FILES))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(event.request);
			if (cached) return cached;
			try {
				return await fetch(event.request);
			} catch {
				const shell = event.request.mode === 'navigate' ? await cache.match('./') : undefined;
				return shell ?? Response.error();
			}
		})()
	);
});
