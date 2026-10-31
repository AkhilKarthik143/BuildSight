# Marker AR: human field checks

Automated tests use synthetic marker images. These boxes are **not checked**: a human must run them on physical hardware before calling the AR accurate or production-ready.

## Setup
- [ ] Print `/ar/markers` on A4 and US Letter, portrait, actual size/100%, with browser headers/footers off. Confirm the scale bar is exactly 50 mm and each black marker is 28 mm wide. The whitespace around a marker is not part of its size.
- [ ] Keep the full sheet flat. Place the build inside the workspace and keep it fixed relative to the sheet. Don't cut apart or rearrange the corners.
- [ ] Open a build, enable **AR overlay** (or press G). Show all four markers. It should say **Mat tracked**, without numbered calibration taps.
- [ ] Pin a target, tap/drag to correct it, use the 1 mm nudge buttons, then select **Done positioning**. The label must say **Your placement**. A pin is your choice, not automatic stud detection or proof of a correct assembly.

## Camera / tracking
- [ ] Test iPhone Safari and Android Chrome over HTTPS. Check rear camera permissions, portrait/landscape rotation, page background/resume, interrupted camera and battery-saving mode.
- [ ] Test bright diffuse light, dim light, glare and shadows. Reject flickering/false marker IDs; no misplaced “locked” guide should remain after tracking is lost.
- [ ] Move from roughly 25 to 70 cm above the mat. Record useful distance, tilt limits and marker pixel size. At steep tilt or long distance it should fall back and say **Show the mat corners**.
- [ ] Cover one corner with a hand: three markers should maintain tracking. Cover two: the guide should disappear after the short hysteresis, returning to existing camera-motion handling for unanchored boxes.
- [ ] Slowly move the phone and then make a fast move. Check jitter, lag and recovery; leave it running for five minutes and record drift and temperature. Target is 15+ detections/s on a mid-range phone; only laptop synthetic timings have been measured so far.
- [ ] Rotate the mat with the build fixed to it. Pins should follow. Move only the bricks: pins will NOT follow; reposition them or recheck. A mat homography cannot track independent objects.
- [ ] Test tall bricks and side views. Document parallax: this is a 2D plane, not height-aware 3D registration. Do not rely on the box edge as a physical measurement.

## Workflow / accessibility
- [ ] Trigger Check build, move the phone while waiting, and confirm returned error boxes use the captured image's registration. Verify photo boxes and issue labels match.
- [ ] Turn AR off or lose tracking. Check build, voice, Auto Mode, step navigation and photo error boxes must still work. Switching steps must clear the old placement pin.
- [ ] Verify the guide toggle is remembered without touching step progress. Private browsing/storage failure must not break the toggle.
- [ ] Keyboard-only: open AR, Pin target, Place at mat center, then nudge. Check focus visibility, screen-reader tracking announcements, text zoom and reduced motion.
- [ ] Phone and laptop on the same HTTPS origin: pair, choose **Use phone camera**, close the dialog, check a step, and verify the phone receives step/check updates. Pause the phone: capture must become unavailable instead of silently checking the laptop camera. Return to laptop/disconnect during a check: no late response from the old source.
- [ ] PWA: install after visiting the demo, then go offline. Verify shell/manual assets already downloaded open. Paid checking and uncached assets must report unavailable honestly.

Record device/browser versions, paper measurement, lighting, distances, detector FPS and failures here. No real-phone result is claimed by the automated run.
