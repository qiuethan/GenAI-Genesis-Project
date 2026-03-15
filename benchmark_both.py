"""Benchmark TANet + SAMP-Net running concurrently on MPS.

Tests:
1. Sequential: TANet then SAMP-Net (simulates serial API calls)
2. Concurrent: Both models via ThreadPoolExecutor (simulates parallel API calls)
3. Full pipeline: Image decode + saliency + both models (realistic server latency)
"""

import os
import sys
import time
import torch
import torch.nn.functional as F
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import torchvision.transforms as T

# Patch adaptive pooling for MPS before importing models
_c_adaptive_avg_pool2d = torch._C._nn.adaptive_avg_pool2d

def _safe_adaptive_avg_pool2d(input, output_size):
    if input.device.type == 'mps':
        os_ = torch.nn.modules.utils._pair(output_size)
        h, w = input.shape[-2], input.shape[-1]
        if (h % os_[0] != 0) or (w % os_[1] != 0):
            return _c_adaptive_avg_pool2d(input.cpu(), os_).to(input.device)
    return _c_adaptive_avg_pool2d(input, output_size)

torch._C._nn.adaptive_avg_pool2d = _safe_adaptive_avg_pool2d

_c_adaptive_max_pool2d = torch._C._nn.adaptive_max_pool2d

def _safe_adaptive_max_pool2d(input, output_size):
    if input.device.type == 'mps':
        os_ = torch.nn.modules.utils._pair(output_size)
        h, w = input.shape[-2], input.shape[-1]
        if (h % os_[0] != 0) or (w % os_[1] != 0):
            result = _c_adaptive_max_pool2d(input.cpu(), os_)
            return (result[0].to(input.device), result[1].to(input.device))
    return _c_adaptive_max_pool2d(input, output_size)

torch._C._nn.adaptive_max_pool2d = _safe_adaptive_max_pool2d

from server.model.tanet import TANet
from server.model.samp_net import SAMPNet
from server.config import Config as SAMPConfig
from server.inference.saliency import detect_saliency
from server.setup_model import TANET_PATH, PLACES365_PATH, SAMP_PATH

IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]


def load_models(device_name):
    """Load both models onto the specified device."""
    device = torch.device(device_name)

    print(f"Loading TANet on {device_name}...")
    tanet = TANet(places365_path=PLACES365_PATH)
    state = torch.load(TANET_PATH, map_location='cpu', weights_only=False)
    # Filter out size-mismatched keys (AVA head is 10-class, server head is 1-class)
    model_state = tanet.state_dict()
    filtered = {k: v for k, v in state.items()
                if k in model_state and v.shape == model_state[k].shape}
    tanet.load_state_dict(filtered, strict=False)
    tanet.to(device).eval()
    tanet_params = sum(p.numel() for p in tanet.parameters())

    print(f"Loading SAMP-Net on {device_name}...")
    cfg = SAMPConfig()
    sampnet = SAMPNet(cfg, pretrained=False)
    state = torch.load(SAMP_PATH, map_location='cpu', weights_only=True)
    sampnet.load_state_dict(state)
    sampnet.to(device).eval()
    sampnet_params = sum(p.numel() for p in sampnet.parameters())

    print(f"  TANet:    {tanet_params:,} params ({tanet_params * 4 / 1024 / 1024:.1f} MB)")
    print(f"  SAMP-Net: {sampnet_params:,} params ({sampnet_params * 4 / 1024 / 1024:.1f} MB)")
    print(f"  Total:    {(tanet_params + sampnet_params):,} params "
          f"({(tanet_params + sampnet_params) * 4 / 1024 / 1024:.1f} MB)")

    return tanet, sampnet, device


def make_inputs(device, with_saliency=True):
    """Create synthetic 224x224 inputs."""
    image = torch.randn(1, 3, 224, 224, device=device)
    saliency = torch.randn(1, 1, 224, 224, device=device) if with_saliency else None
    return image, saliency


def warmup(tanet, sampnet, device, n=10):
    """Warmup both models."""
    image, saliency = make_inputs(device)
    with torch.no_grad():
        for _ in range(n):
            tanet(image)
            sampnet(image, saliency)
            if device.type == 'mps':
                torch.mps.synchronize()
    print("  Warmup done")


def sync(device):
    if device.type == 'mps':
        torch.mps.synchronize()


# ---------------------------------------------------------------------------
# Benchmark 1: Each model individually
# ---------------------------------------------------------------------------
def bench_individual(tanet, sampnet, device, num_runs=200):
    image, saliency = make_inputs(device)

    print(f"\n{'='*60}")
    print(f"Individual model latency ({device.type.upper()}, {num_runs} runs)")
    print(f"{'='*60}")

    # TANet
    latencies_tanet = []
    with torch.no_grad():
        for _ in range(num_runs):
            sync(device)
            t0 = time.perf_counter()
            tanet(image)
            sync(device)
            latencies_tanet.append((time.perf_counter() - t0) * 1000)

    # SAMP-Net
    latencies_samp = []
    with torch.no_grad():
        for _ in range(num_runs):
            sync(device)
            t0 = time.perf_counter()
            sampnet(image, saliency)
            sync(device)
            latencies_samp.append((time.perf_counter() - t0) * 1000)

    lt = np.array(latencies_tanet)
    ls = np.array(latencies_samp)
    print(f"  TANet:    mean={lt.mean():.2f}ms  median={np.median(lt):.2f}ms  p95={np.percentile(lt, 95):.2f}ms")
    print(f"  SAMP-Net: mean={ls.mean():.2f}ms  median={np.median(ls):.2f}ms  p95={np.percentile(ls, 95):.2f}ms")
    return lt, ls


# ---------------------------------------------------------------------------
# Benchmark 2: Sequential (both models, one after another)
# ---------------------------------------------------------------------------
def bench_sequential(tanet, sampnet, device, num_runs=200):
    image, saliency = make_inputs(device)

    print(f"\n{'='*60}")
    print(f"Sequential (TANet then SAMP-Net, {num_runs} runs)")
    print(f"{'='*60}")

    latencies = []
    with torch.no_grad():
        for _ in range(num_runs):
            sync(device)
            t0 = time.perf_counter()
            tanet(image)
            sampnet(image, saliency)
            sync(device)
            latencies.append((time.perf_counter() - t0) * 1000)

    l = np.array(latencies)
    print(f"  Combined: mean={l.mean():.2f}ms  median={np.median(l):.2f}ms  p95={np.percentile(l, 95):.2f}ms")
    print(f"  FPS:      {1000 / l.mean():.1f}")
    return l


# ---------------------------------------------------------------------------
# Benchmark 3: Batched (feed both models without syncing between them)
# ---------------------------------------------------------------------------
def bench_batched(tanet, sampnet, device, num_runs=200):
    image, saliency = make_inputs(device)

    print(f"\n{'='*60}")
    print(f"Batched (submit both, sync once at end, {num_runs} runs)")
    print(f"{'='*60}")

    latencies = []
    with torch.no_grad():
        for _ in range(num_runs):
            sync(device)
            t0 = time.perf_counter()
            # Submit both to GPU command queue without intermediate sync
            tanet_out = tanet(image)
            samp_out = sampnet(image, saliency)
            # Single sync at the end
            sync(device)
            latencies.append((time.perf_counter() - t0) * 1000)

    l = np.array(latencies)
    print(f"  Combined: mean={l.mean():.2f}ms  median={np.median(l):.2f}ms  p95={np.percentile(l, 95):.2f}ms")
    print(f"  FPS:      {1000 / l.mean():.1f}")
    return l


# ---------------------------------------------------------------------------
# Benchmark 4: Full realistic pipeline (decode + saliency + both models)
# ---------------------------------------------------------------------------
def bench_full_pipeline(tanet, sampnet, device, num_runs=100):
    """Simulates what the server actually does: preprocess + infer both."""
    transform = T.Compose([
        T.ToPILImage(),
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=IMAGE_NET_MEAN, std=IMAGE_NET_STD),
    ])

    # Simulate a camera frame (random BGR image at typical resolution)
    fake_frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)

    print(f"\n{'='*60}")
    print(f"Full pipeline: 1280x720 BGR -> preprocess -> both models ({num_runs} runs)")
    print(f"{'='*60}")

    latencies = []
    latencies_preprocess = []
    latencies_inference = []

    with torch.no_grad():
        for _ in range(num_runs):
            t0 = time.perf_counter()

            # Preprocess (same for both models)
            rgb = fake_frame[:, :, ::-1].copy()
            tensor = transform(rgb).unsqueeze(0).to(device)

            # Saliency for SAMP-Net
            sal_map = detect_saliency(fake_frame)
            sal_tensor = torch.from_numpy(sal_map).unsqueeze(0).unsqueeze(0).to(device)

            t_pre = time.perf_counter()
            latencies_preprocess.append((t_pre - t0) * 1000)

            # Run both models
            tanet_out = tanet(tensor)
            samp_weight, samp_attr, samp_scores = sampnet(tensor, sal_tensor)
            sync(device)

            t_inf = time.perf_counter()
            latencies_inference.append((t_inf - t_pre) * 1000)
            latencies.append((t_inf - t0) * 1000)

    lp = np.array(latencies_preprocess)
    li = np.array(latencies_inference)
    lt = np.array(latencies)
    print(f"  Preprocess:  mean={lp.mean():.2f}ms  (resize + normalize + saliency)")
    print(f"  Inference:   mean={li.mean():.2f}ms  (TANet + SAMP-Net sequential)")
    print(f"  Total:       mean={lt.mean():.2f}ms  median={np.median(lt):.2f}ms  p95={np.percentile(lt, 95):.2f}ms")
    print(f"  FPS:         {1000 / lt.mean():.1f}")
    return lt


if __name__ == '__main__':
    device_name = 'mps' if torch.backends.mps.is_available() else 'cpu'

    tanet, sampnet, device = load_models(device_name)
    warmup(tanet, sampnet, device, n=20)

    # Run all benchmarks
    lt_individual, ls_individual = bench_individual(tanet, sampnet, device)
    l_sequential = bench_sequential(tanet, sampnet, device)
    l_batched = bench_batched(tanet, sampnet, device)
    l_pipeline = bench_full_pipeline(tanet, sampnet, device)

    # Also test on CPU for comparison
    if device_name == 'mps':
        tanet_cpu, sampnet_cpu, device_cpu = load_models('cpu')
        warmup(tanet_cpu, sampnet_cpu, device_cpu, n=5)
        lt_cpu, ls_cpu = bench_individual(tanet_cpu, sampnet_cpu, device_cpu, num_runs=50)
        l_seq_cpu = bench_sequential(tanet_cpu, sampnet_cpu, device_cpu, num_runs=50)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"\n  MPS Results:")
    print(f"    TANet alone:           {lt_individual.mean():.2f} ms")
    print(f"    SAMP-Net alone:        {ls_individual.mean():.2f} ms")
    print(f"    Sequential (both):     {l_sequential.mean():.2f} ms  ({1000/l_sequential.mean():.0f} FPS)")
    print(f"    Batched (both):        {l_batched.mean():.2f} ms  ({1000/l_batched.mean():.0f} FPS)")
    print(f"    Full pipeline (both):  {l_pipeline.mean():.2f} ms  ({1000/l_pipeline.mean():.0f} FPS)")

    if device_name == 'mps':
        print(f"\n  CPU Results:")
        print(f"    TANet alone:           {lt_cpu.mean():.2f} ms")
        print(f"    SAMP-Net alone:        {ls_cpu.mean():.2f} ms")
        print(f"    Sequential (both):     {l_seq_cpu.mean():.2f} ms  ({1000/l_seq_cpu.mean():.0f} FPS)")

    viable = l_pipeline.mean() < 100  # under 100ms = viable for real-time camera
    print(f"\n  Viable for real-time camera? {'YES' if viable else 'NO'} "
          f"(target: <100ms, actual: {l_pipeline.mean():.1f}ms)")
