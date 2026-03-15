# Frame

An AI-powered camera app that provides real-time composition coaching to help you take better photos. The app scores your framing using a neural aesthetic model and gives directional suggestions, while on-device object detection and sensor-based coaching overlays guide you toward sharper, better-exposed shots.

## Architecture

The project has two main components:

- **Mobile app** (`app/`) — React Native / Expo app with Vision Camera, on-device YOLO (CoreML), and frame processors for blur and exposure analysis.
- **Scoring server** (`server/`) — Python HTTP server running TANet for aesthetic composition scoring and YOLO for object detection. Runs on your Mac and communicates with the app over the local network.

The app auto-discovers the server by extracting the Mac's IP from the Metro dev server URL — no manual configuration needed.

## Features

- **Composition scoring** — Frames are sent to the TANet model on the server, which returns a score and directional suggestions (e.g. "Try moving right").
- **Coaching overlays** — Real-time feedback for blur, camera shake, device level, and exposure issues.
- **Scan mode** — Select objects via on-device YOLO (CoreML), then the app tracks and scores frames containing those objects.
- **Gallery scoring** — Saved photos are scored and displayed with composition badges.
- **Color filters** — Skia-based filters including vivid, dramatic, mono, silvertone, and noir.

## Quick Setup Guide

**Prerequisites**: macOS, iPhone connected via USB (trusted), Xcode installed

### 1. Accept Xcode license & set developer path
```bash
sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Install dependencies
```bash
npm install
python3 -m venv venv
source venv/bin/activate
pip install torch torchvision einops scipy opencv-contrib-python ultralytics
```

### 3. Download model weights
```bash
source venv/bin/activate
python -m server.setup_model
```

### 4. Start the scoring server (Terminal 1)
```bash
source venv/bin/activate
python -m server.server
```
Wait until you see "Composition assessment server running on http://0.0.0.0:8420"

### 5. Start Metro bundler (Terminal 2)
```bash
npx expo start
```

### 6. Build & run on iPhone
Open Xcode:
```bash
open ios/Frame.xcworkspace
```
- Select your iPhone in the device dropdown
- Set your signing team (Frame target → Signing & Capabilities)
- Hit **Run** (Cmd+R)

> **Note**: `npx expo run:ios --device` may not work due to a `devicectl` compatibility bug — use Xcode directly instead.

## Mock data (seed)

To populate challenges and test users so you can try the feed, submissions, and social features:

1. **Challenges** — In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `supabase/migrations/004_seed_mock_challenges.sql`. This adds one ACTIVE, two SCHEDULED, and two CLOSED challenges.

2. **Test users and submissions** — In `.env` set `SUPABASE_SERVICE_ROLE_KEY` (or keep `SUPABASE_SECRET_KEY`; the script uses either). Then run:
   ```bash
   npm run seed
   ```
   This creates four users (`alice@frame.test` … `dana@frame.test`, password `testpass123`), gives them profile names, seeds submissions with placeholder images, and adds a few reactions and comments. Log in with any of those emails in the app to verify the feed and challenges.

3. **Seed your profile (followers, following, podiums)** — Run the migration `supabase/migrations/006_seed_profile_william.sql` in the Supabase SQL Editor (or run `supabase db push` if you use the CLI). It targets the profile with username **William** (case-insensitive) and:
   - Adds mutual follows with up to 5 other existing users (so run step 2 first if you want non-zero followers/following).
   - Assigns podium ranks (1st, 2nd, 3rd) and scores to your submissions (one per challenge, up to 3).
   - Updates your profile stats (Challenges, Podiums, Follower/Following counts). Safe to run multiple times.

## Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Full composition score with blur rejection and suggestions |
| `/score` | POST | Lightweight scoring (gallery and scan use) |
| `/detect` | POST | YOLO object detection |
| `/scan` | POST | Score + object presence check for selected targets |

All POST endpoints accept a JPEG body and return JSON.

## Project Structure

```
├── app/
│   ├── App.tsx                        # Root component
│   └── src/
│       ├── app/
│       │   ├── App.tsx                # Navigation + providers
│       │   └── navigation/            # Stack navigator and route types
│       ├── features/camera/
│       │   ├── screens/               # Camera, Gallery, ImageViewer
│       │   ├── components/            # Overlays, controls, coaching hints
│       │   └── hooks/                 # Composition scoring, coaching, scan mode
│       ├── infra/
│       │   ├── visionCamera/          # Camera view, zoom, frame processors
│       │   ├── frameProcessing/       # Blur and exposure analysis
│       │   ├── network/               # Server URL auto-detection
│       │   ├── mediaLibrary/          # Photo save/load
│       │   ├── sensors/               # Motion and orientation
│       │   ├── imageProcessing/       # Skia color filters
│       │   └── icons/                 # Icon components
│       └── shared/                    # Shared types
├── server/
│   ├── server.py                      # HTTP server (port 8420)
│   ├── main.py                        # Standalone viewfinder pipeline
│   ├── setup_model.py                 # Model weight downloader
│   ├── model/                         # TANet, NIMA, SAMP-Net architectures
│   ├── inference/                     # Predictor, detector, saliency
│   └── pipeline/                      # Capture/inference/display pipeline
├── plugins/
│   ├── withCoreMLModel.js             # Expo config plugin for CoreML
│   └── native-sources/               # Swift/ObjC YOLO frame processor plugin
├── package.json
├── app.json                           # Expo configuration
└── tsconfig.json
```

## Server Options

```bash
python -m server.server --port 8420      # custom port (default: 8420)
python -m server.server --device cpu     # force CPU inference
python -m server.server --device mps     # Apple Silicon GPU (default)
```

## Tech Stack

**Mobile:**
- Expo 54 / React Native 0.81
- React Native Vision Camera
- React Native Skia
- React Native Reanimated
- CoreML (on-device YOLO11s)

**Server:**
- PyTorch
- TANet (ResNet-18 Places365 + MobileNetV2 + attention)
- Ultralytics YOLO
- OpenCV
