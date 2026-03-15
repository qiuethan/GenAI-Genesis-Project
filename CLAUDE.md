# CLAUDE.md

## Project Overview

React Native (Expo) camera app that sends frames to a local Python server for ML-based composition/aesthetic scoring over USB.

- **App**: `app/` — TypeScript, React Native, Expo
- **Server**: `server/` — Python, PyTorch (MPS), FastSAM, Gemini API

## Server Architecture

- `ThreadingMixIn` HTTP server — each request gets its own Python thread
- Models loaded once at startup as globals (`_predictor`, `_fastsam`)
- Must declare all globals in `main()` with `global _predictor, _fastsam` or assignments create local variables and the globals stay `None`
- **MPS is not thread-safe**: concurrent GPU submissions from multiple threads deadlock the Metal command queue. All GPU inference must be serialized via `_gpu_lock` (a `threading.Lock`)
- `/analyze-composition` calls the Gemini API (network I/O, no local GPU) — does not need the GPU lock

## React Native Pitfalls

- **Never use a sensor hook's returned object as a `useEffect` dependency.** Hooks like `useMotionDetector` return a new object reference on every state update. Using the object as a dep causes the effect to fire every render. Use individual primitive properties instead (e.g., `motion.isShaking`), and only the ones that actually matter for the effect's logic.
- **Sensor-driven hooks must minimize setState calls.** Sensor listeners (DeviceMotion, accelerometer) fire at 20-33Hz. Calling `setState` on every tick causes 20-33 re-renders/sec across the entire component tree, which starves the JS thread and prevents network requests from flushing. Only call `setState` when the derived coaching state actually changes (e.g., `isLevel` or `hintText` transitions). Store continuously-changing values like angles in refs instead.
- **Avoid `Promise.all` for heavy native-bridged work** (e.g., `ImageManipulator.manipulateAsync`). Multiple concurrent native bridge calls saturate the JS thread, preventing `fetch` requests from flushing. Requests get queued and only dispatch when the app is backgrounded. Process sequentially instead.
- When the JS thread is clogged (no requests sending, app unresponsive), press `r` in the Metro terminal to force-reload the bundle. Closing/reopening the app may serve a cached bundle.

## Running

- `npx expo start` — JS-only changes (hooks, components, styles)
- `npx expo run:ios --device` — native changes (new modules, app.json, ios/ directory, first install)
- Server: `python -m server.server` (default: MPS, port 8420)
