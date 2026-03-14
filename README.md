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

## Prerequisites

- macOS with Apple Silicon (MPS) or CPU fallback
- iPhone (physical device required for camera)
- Node.js and npm
- Python 3.9+
- Xcode (for the iOS native build)
- iPhone and Mac on the same Wi-Fi network or connected via USB

## Getting Started

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Set up the Python environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r server/requirements.txt
```

### 3. Download pretrained model weights

```bash
source venv/bin/activate
python -m server.setup_model
```

This downloads TANet, SAMP-Net, and NIMA weights into `server/pretrained_model/`.

### 4. Start the scoring server

```bash
source venv/bin/activate
python -m server.server
```

The server starts on port 8420. Verify with:

```bash
curl http://localhost:8420/health
```

### 5. Build and run the iOS app

In a separate terminal:

```bash
npx expo run:ios --device
```

Select your iPhone when prompted. The first build takes a while as it compiles native modules (Vision Camera, Skia, CoreML YOLO, etc.).

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
