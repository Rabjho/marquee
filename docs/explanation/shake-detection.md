# About shake detection

Shaking the phone while the sign plays turns blinking on or off. It is the app's
signature gesture, so it has to work on every phone or step aside cleanly. This page
explains how a shake is recognised and what happens when it cannot be.

## Measuring a shake

The app listens to the `devicemotion` event and takes the length of the acceleration
vector, not any single axis. Phones disagree about axis directions and signs, and a
person can hold the phone in any orientation, but the length of the vector means the same
thing everywhere. When the browser reports acceleration without gravity, that is used
directly; otherwise gravity (about 9.8 m/s²) is subtracted from the total.

A reading above 14 m/s² counts as hard. Lifting the phone up to show the sign stays well
under that. A single hard reading is not enough, though: a bump or a quick lift can produce
one. A real shake swings back and forth, so it takes two hard readings within half a
second. After a shake, a one-second cooldown stops one long shake from toggling blinking
on and off again.

## Asking for permission on iOS

iOS hides motion data behind a permission prompt, and only shows that prompt in response
to a tap. The app asks from inside the Go handler, before anything asynchronous, so the
prompt feels like part of starting the sign. If the person refuses, iOS will not ask again
until the app is fully closed and reopened.

The code does not check which operating system it runs on. It checks whether
`DeviceMotionEvent.requestPermission` exists; if it does, it asks, and if not, it starts
listening straight away.

## When there is no sensor

Desktop browsers expose `devicemotion` but never send real data. So after it starts
listening, the app waits one second for a reading. If none arrives, or permission was
refused, shake counts as unavailable and the playing screen shows a Blink button instead.
Blinking therefore never depends on the sensor.

## Shake and the iOS undo prompt

On iOS, shaking a page that has typing to undo pops up "Undo Typing" over everything. The
text box avoids this by never leaving undo history; see
[ADR 0008](../adr/0008-apply-text-edits-by-script.md).
