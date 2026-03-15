# Frame

**A live viewfinder that fuses three peer-reviewed vision models into one pipeline to score your composition in real-time — before you press the shutter.**

---

## Inspiration

The best photographers aren't born. The rest of us just never got better.

Our phones carry cameras more capable than the ones that produced the most celebrated images of the last century. But most of what we shoot disappears into a forgotten iCloud folder before it's even seen.

We built Frame because we found that no amount of post-processing can remedy a poorly composed photo. Every moment is temporary and we only have one shot to capture it. We combine a personal multimodal photography teacher with an open social ecosystem to challenge you daily and learn from the best.

## What It Does

- **Real-time composition feedback** while you frame, including live score updates and directional suggestions
- **Edge AI vision model pipelines** that help you find better framing for selected subjects using on-device segmentation
- **Live coaching overlays** for blur, shake, level, and exposure to improve technical quality before capture
- **Multi-metric photo scoring** across aesthetics, composition quality, and 13 composition technique classifications
- **Social competition platform** with daily themed challenges, AI-scored leaderboards, podium rankings, follows, reactions, and comments

## How We Built It

### AI / ML Pipeline

Frame's scoring engine runs a custom Python inference server that fuses three published research models into a single pipeline:

| Model | Source | Role |
|-------|--------|------|
| **TANet** | IJCAI 2022 — *Rethinking Image Aesthetics Assessment* | Theme-adaptive aesthetic quality scoring (0-100) using ResNet-18 + MobileNetV2 with cross-attention |
| **SAMP-Net** | BMVC 2021 — *Image Composition Assessment with Saliency-augmented Multi-pattern Pooling* | Composition quality scoring with attribute-level breakdown (rule of thirds, symmetry, balance, depth of field, repetition) |
| **FastSAM** | *Fast Segment Anything* | Real-time object segmentation for scan mode — detects subjects and evaluates framing alternatives |

A custom **ResNet-18 composition classifier** trained on the 13 composition techniques maps every frame to its dominant technique (center, rule of thirds, golden ratio, triangle, diagonal, symmetric, curved, radial, vanishing point, pattern, horizontal, vertical, fill the frame).

The pipeline also integrates:
- **Laplacian variance** blur detection to reject soft frames before scoring
- **Google Gemini API** for annotated composition overlays with drawn guide lines
- **Batch scoring** for gallery analysis (up to 10 images per request)

All inference runs on Apple Silicon GPU (MPS) with a thread-safe locking mechanism to serialize Metal command submissions.

### Camera System

The camera layer is built on **React Native Vision Camera** with frame processor worklets running at sensor framerate:

- **Composition Score Overlay** — Streams cropped, resized frames (640px JPEG at 70% quality) to the local server for live aesthetic + composition scoring
- **Scan Mode** — On-device **YOLO11s** (CoreML) detects objects in the viewfinder; tapping a detected subject triggers targeted composition scoring for that region
- **Blur Coach** — Laplacian sharpness analysis with EMA smoothing, hysteresis thresholds, and brightness calibration (first 30 frames)
- **Shake Coach** — DeviceMotion-based shake detection with debounce
- **Level Coach** — Accelerometer-driven horizon level indicator
- **Exposure Coach** — Real-time brightness analysis with over/underexposure hints
- **Pattern Overlay** — Dynamic composition grid visualization (rule of thirds, golden ratio, symmetry, triangle, diagonals, golden spiral)
- **Color Filters** — Skia GPU-rendered real-time filters (vivid, dramatic, mono, silvertone, noir)

### Social Platform

The social layer runs on **Supabase** (hosted PostgreSQL) with row-level security:

- **Daily Challenges** — Automatically rotated via `pg_cron`, cycling through 13 composition techniques with themed topics (Urban Rush, Wildlife Portraits, Golden Hour Landscapes, etc.)
- **Following Feed** — Home feed surfaces submissions from users you follow, sorted chronologically
- **Explore Feed** — Global discovery feed across all challenges
- **Leaderboards** — Per-challenge rankings computed from AI scores with trophy badges for top 3
- **Reactions, Comments & Follows** — Full social graph with threaded comments, likes, bookmarks, and follower/following lists
- **Composition Badges** — Earned automatically when a user accumulates 3+ top-10 finishes in a single composition category

### Database Schema

Six core tables with PostgreSQL triggers for real-time count synchronization:

- `challenges` — Daily competitions with status lifecycle (SCHEDULED -> ACTIVE -> CLOSED)
- `submissions` — Photos with AI scores, composition metadata, and rankings
- `user_profiles` — Stats, badges, social counts, avatars
- `reactions` / `comments` / `follows` / `saved_posts` — Social interactions

Storage buckets for submission photos and user avatars with public read policies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native 0.81, Expo 54, TypeScript 5.9 |
| **Navigation** | React Navigation 7 (native stack + bottom tabs) |
| **Camera** | React Native Vision Camera 4.7, CoreML YOLO11s |
| **Graphics** | React Native Skia, Reanimated 4 |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, RLS) |
| **ML Server** | Python, PyTorch (MPS), TANet, SAMP-Net, FastSAM |
| **Vision API** | Google Gemini (composition annotation) |
| **On-device ML** | CoreML YOLO11s (object detection) |

## Architecture

```
iPhone (Expo / React Native)
  |-- Vision Camera -> Frame Processors (blur, exposure)
  |-- CoreML YOLO11s -> On-device object detection
  |-- USB/Network -> Python inference server
  |     |-- TANet -> Aesthetic score
  |     |-- SAMP-Net -> Composition score + attributes
  |     |-- ResNet-18 -> Composition type classification
  |     |-- FastSAM -> Segmentation masks
  |-- Supabase SDK -> Auth, DB, Storage
  |-- UI Layer -> Overlays, Feed, Challenges, Profiles
```

## Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Full composition score with blur rejection and suggestions |
| `/score` | POST | Lightweight scoring (gallery and scan use) |
| `/score-batch` | POST | Batch scoring up to 10 images (multipart/form-data) |
| `/classify-composition` | POST | Composition type classification only |
| `/analyze-composition` | POST | Gemini API-based annotated composition overlay |
| `/edges` | POST | FastSAM segmentation outlines as base64 PNG |

All POST endpoints accept a JPEG body (or multipart for batch) and return JSON.

## Project Structure

```
├── app/
│   └── src/
│       ├── app/navigation/            # Stack navigators, route types, tab bar
│       ├── features/
│       │   ├── auth/                   # Auth context, sign-in/sign-up
│       │   ├── camera/                 # Camera screen, coaching overlays, hooks
│       │   ├── challenges/             # Challenge list, detail, submission, hooks
│       │   ├── explore/                # Global discovery feed
│       │   ├── home/                   # Following feed + challenge hero card
│       │   └── profile/                # Profile, settings, search, follow lists
│       ├── shared/                     # PostCard, comments, services, hooks, types
│       └── infra/                      # Supabase client, sensors, network, camera
├── server/
│   ├── server.py                       # HTTP server (port 8420)
│   ├── setup_model.py                  # Model weight downloader
│   ├── model/                          # TANet, SAMP-Net architectures
│   ├── inference/                      # Predictor, saliency, Gemini integration
│   └── pipeline/                       # Capture/inference/display pipeline
├── supabase/
│   ├── migrations/                     # 9 SQL migrations (schema, triggers, storage)
│   └── seed.sql                        # Full seed (users, challenges, submissions)
└── plugins/                            # Expo config plugin for CoreML models
```

## Running Locally

**Prerequisites:** macOS, iPhone connected via USB (trusted), Xcode installed

### App
```bash
npm install
npx expo start                          # JS-only development
npx expo run:ios --device               # native build (first install / native changes)
```

### Server
```bash
cd server
pip install -r requirements.txt
python -m server.setup_model            # download model weights
python -m server.server                 # default: MPS GPU, port 8420
python -m server.server --device cpu    # force CPU inference
```

### Database
```bash
supabase db reset --linked              # reset remote DB + run migrations + seed
```

## Team

Built at GenAI Genesis 2025.
