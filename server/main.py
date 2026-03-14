"""Live Viewfinder Composition Assessment with SAMP-Net.

Usage:
    python -m server.main              # default: MPS device, camera 0
    python -m server.main --device cpu  # force CPU
    python -m server.main --camera 1    # use camera index 1
"""

import argparse
import os
import sys

from .setup_model import download_model, MODEL_PATH
from .pipeline.engine import PipelineEngine


def main():
    parser = argparse.ArgumentParser(description="Live composition assessment viewfinder")
    parser.add_argument("--device", default="mps",
                        help="Torch device: mps, cpu, or cuda (default: mps)")
    parser.add_argument("--camera", type=int, default=0,
                        help="Camera index (default: 0)")
    parser.add_argument("--checkpoint", default=None,
                        help="Path to samp_net.pth (auto-downloads if not provided)")
    args = parser.parse_args()

    # Resolve checkpoint
    checkpoint = args.checkpoint or MODEL_PATH
    if not os.path.exists(checkpoint):
        print("Pretrained model not found. Downloading...")
        checkpoint = download_model()

    # Validate device
    import torch
    device = args.device
    if device == "mps" and not torch.backends.mps.is_available():
        print("MPS not available, falling back to CPU")
        device = "cpu"
    elif device == "cuda" and not torch.cuda.is_available():
        print("CUDA not available, falling back to CPU")
        device = "cpu"

    # Run pipeline
    engine = PipelineEngine(
        checkpoint_path=checkpoint,
        camera_id=args.camera,
        device=device,
    )
    engine.run()


if __name__ == "__main__":
    main()
