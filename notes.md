# Model Outputs

## TANet

**Input:** 224x224 RGB image
**Output:** Single sigmoid scalar (0-1), representing overall aesthetic quality (lighting, color, mood, scene).

Trained on TAD66K dataset. Three-branch architecture: ResNet-18 (Places365) + MobileNetV2 + RGB Attention, fused to a single score.

## SAMP-Net

**Input:** 224x224 RGB image + 224x224 saliency map
**Output:** Three things:

1. **`scores`** — 5-class distribution (softmax over composition quality levels 1-5). Weighted mean gives scalar composition score.

2. **`weight`** — Pattern importance weights (softmax over 8 spatial patterns), identifying *which* composition structure the image uses:
   - P1: Horizontal split (top/bottom)
   - P2: Vertical split (left/right)
   - P3: Upper triangle
   - P4: Lower triangle
   - P5: Center vs surround
   - P6: Quadrants
   - P7: Diagonal cross
   - P8: Rule of thirds (3x3)

3. **`attribute`** — Predictions for 6 composition attributes:
   - Rule of Thirds
   - Balancing Elements
   - Depth of Field
   - Object (subject placement)
   - Symmetry
   - Repetition

Trained on CADB (Composition Assessment DataBase) with human composition ratings.

## Integration Strategy

TANet gives the "how good does this look" number. SAMP-Net gives the "what composition is this and how well is it executed" breakdown. Together: TANet for the overall score, SAMP-Net for composition coaching (why it's good/bad, what to improve).

Weighting TBD — need to run evals (grid search on shared dataset) then human-in-the-loop tuning.

# Current User Flow

## Camera Screen (PHOTO mode)
- Live preview with grid overlay
- Every 1.5s: capture frame → POST `/analyze` → server runs TANet → returns score 0-100
- Score displayed as colored pill (red/orange/yellow/green)
- On-device coaching overlays: shake detection, level line, exposure warnings
- Tap shutter → optional timer/flash → capture → crop to aspect ratio → save to library → score in background
- No post-capture review screen — stays on camera

## Camera Screen (SCAN mode)
- On-device YOLO11s (CoreML) detects objects, shows bounding boxes
- User taps to select objects of interest
- "Start Scan" runs 6-second capture: frame every 500ms → POST `/score` → picks best-scored frame

## Gallery Screen
- 4-column grid of photos from device library
- Each photo gets a colored score badge (fetched via POST `/score`, cached in AsyncStorage)
- Tap photo → full-screen horizontal swipe viewer (no score shown)

## Server Endpoints
- `POST /analyze` — live scoring with blur rejection (TANet only)
- `POST /score` — lightweight scoring for gallery/scan (TANet only)
- `POST /detect` — YOLO object detection
- `POST /scan` — score + check if selected objects are in frame
- `GET /health` — health check

## What's Active vs Dead Code
- **Active:** TANet, YOLO11n (server), YOLO11s CoreML (on-device), coaching sensors
- **Dead:** SAMP-Net (model exists, never loaded), saliency module (unused)

# Benchmark Results (MacBook Pro, MPS)

## Individual Models
| Model | Params | MPS (batch=1) | CPU (batch=1) |
|---|---|---|---|
| TANet | 13.9M (53 MB) | 7.11 ms | 23.89 ms |
| SAMP-Net | 45.8M (175 MB) | 16.26 ms | 9.88 ms* |

*SAMP-Net CPU faster at batch=1 due to MPS adaptive pooling fallback for non-divisible tensor sizes.

## Both Models Together
| Scenario | MPS | CPU |
|---|---|---|
| Sequential (inference only) | 22.97 ms (44 FPS) | 34.20 ms (29 FPS) |
| Full pipeline (decode + saliency + both) | 32.49 ms (31 FPS) | — |

Viable for the 1.5s scoring interval the app uses (~32ms per call).
