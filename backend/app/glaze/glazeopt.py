"""Glaze optimiser – adversarial perturbation engine.

Adapted from EspacioLatente/Glaze – fixed decompilation artifacts,
removed PyQt5 signal dependency, added MPS support.
"""

import gc
import os
import pickle
import random
import time
from typing import Callable

import numpy as np
import torch
import torchvision
from PIL import Image
from torchvision import transforms
from diffusers import StableDiffusionImg2ImgPipeline, AutoencoderKL
from diffusers.models.autoencoders.vae import DiagonalGaussianDistribution

from app.glaze.utils import load_img, img2tensor, tensor2img, CLIP, check_clip_threshold

PROD = True
BATCH_SIZE = 1
PERFORMANCE = True


class GlazeOptimizer:
    def __init__(
        self,
        params: dict,
        device: str,
        target_params: dict,
        project_root_path: str,
        jpg: int = 0,
        progress_callback: Callable[[str], None] | None = None,
    ):
        self.params = params
        self.device = device
        self.jpg = jpg
        self.output_dir: str | None = None
        self.half = device in ("cuda", "mps")
        self.target_params = target_params
        self.project_root_path = project_root_path
        self.stable_diffusion_model = None
        self.num_segments_went_through = 0
        self.progress_callback = progress_callback

    # ------------------------------------------------------------------
    # Progress helper (replaces PyQt5 signal.emit)
    # ------------------------------------------------------------------
    def _emit(self, msg: str) -> None:
        if self.progress_callback:
            self.progress_callback(msg)

    # ------------------------------------------------------------------
    # Encoder model lifecycle
    # ------------------------------------------------------------------
    def load_encoder_models(self):
        self.model = torch.load(
            os.path.join(self.project_root_path, "glaze.p"),
            map_location=torch.device("cpu"),
        ).to(self.device).to(torch.float32)

        self.model_qc = torch.load(
            os.path.join(self.project_root_path, "glaze-qc.p"),
            map_location=torch.device("cpu"),
        ).to(self.device).to(torch.float32)

        if self.half:
            self.model = self.model.half()
            self.model_qc = self.model_qc.half()

    def unload_encoder_models(self):
        self.model.to("cpu")
        del self.model
        self.model_qc.to("cpu")
        del self.model_qc
        gc.collect()

    def model_encode(self, input_tensor: torch.Tensor) -> torch.Tensor:
        h = self.model(input_tensor)
        moments = self.model_qc(h)
        posterior = DiagonalGaussianDistribution(moments)
        return posterior.mean

    # ------------------------------------------------------------------
    # Evaluation models (CLIP + VAE)
    # ------------------------------------------------------------------
    def load_eval_models(self):
        self.clip_model = CLIP(self.device, self.project_root_path)
        self.full_vae = AutoencoderKL.from_pretrained(
            os.path.join(self.project_root_path, "base", "base"),
            subfolder="vae",
        )
        self.full_vae.to(self.device)
        if self.half:
            self.full_vae = self.full_vae.half()

    def cal_clip_score(self, img_path: str, seed: int) -> float:
        image_transforms = transforms.Compose([
            transforms.Resize(512, transforms.InterpolationMode.BILINEAR),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])
        cur_img = load_img(img_path, self.project_root_path)
        tmp_path = os.path.join(
            self.project_root_path, f"foo_{random.randrange(0, 100)}.jpg"
        )
        cur_img.save(tmp_path, quality=93)
        cur_img = Image.open(tmp_path)

        torch.manual_seed(seed)
        with torch.no_grad():
            tensor_img = image_transforms(cur_img).unsqueeze(0)
            tensor_img = tensor_img[:, :, :512, :512].to(self.device)
            if self.half:
                tensor_img = tensor_img.half()
            cur_res_img = self.full_vae(tensor_img).sample
            cur_res_img = tensor2img(cur_res_img)
            score = self.clip_model(cur_res_img, self.target_params["style"])

        os.remove(tmp_path)
        return score

    # ------------------------------------------------------------------
    # Stable Diffusion loader
    # ------------------------------------------------------------------
    def load_model(self):
        model_path = os.path.join(self.project_root_path, "base", "base")
        m = StableDiffusionImg2ImgPipeline.from_pretrained(model_path)
        m.to(self.device)
        m.enable_attention_slicing()
        return m

    # ------------------------------------------------------------------
    # Core generation pipeline
    # ------------------------------------------------------------------
    def generate(self, image_paths: list[str]) -> tuple[list[str], bool]:
        error_logs = [
            "Below are errors Glaze encountered while protecting your art:\n"
        ]
        self.num_segments_went_through = 0
        final_path_ls: list[str] = []
        all_tmp_paths: list[list[str]] = []
        self.tot_runs = self.params["n_runs"]

        image_paths = [f for f in image_paths if "-glazed-intensity" not in f]
        image_paths = sorted(image_paths)

        legit_image_paths: list[str] = []
        image_data_ls: list[Image.Image] = []

        for f in image_paths:
            cur_img = load_img(f, self.project_root_path)
            if cur_img is None:
                print(f"ERROR loading {f}")
                continue
            legit_image_paths.append(f)
            image_data_ls.append(cur_img)

        if not legit_image_paths:
            raise ValueError("Zero images detected")
        if len(legit_image_paths) > 20 and PERFORMANCE:
            raise ValueError("Glaze can only process at most 20 images at a time.")
        if len(legit_image_paths) != 1 and self.params["opt_setting"] == "0":
            raise ValueError("Preview mode supports only one image at a time.")

        # Generate style-transfer targets
        self.extract_all_targets(image_data_ls)

        # Run optimisation passes
        if self.params["opt_setting"] != "0":
            self.load_encoder_models()

        for run_num in range(self.params["n_runs"]):
            self.cur_run = run_num
            cur_tmp_paths, legit_image_paths = self.generate_one_run(
                image_data_ls, legit_image_paths, run_num
            )
            all_tmp_paths.append(cur_tmp_paths)

        if self.params["opt_setting"] != "0":
            self.unload_encoder_models()

        # Evaluate and select best run
        if self.params["opt_setting"] != "0":
            self.load_eval_models()
            self._emit("Glaze generated, evaluating strength")

            for idx in range(len(all_tmp_paths[0])):
                cur_seed = random.randrange(0, 1000)
                og_file_path = legit_image_paths[idx]
                og_score = self.cal_clip_score(og_file_path, cur_seed)

                cur_best_score = -1.0
                cur_best_path = None
                print(og_file_path.split("/")[-1])

                for run_num in range(self.params["n_runs"]):
                    cur_image_path = all_tmp_paths[run_num][idx]
                    cur_score = self.cal_clip_score(cur_image_path, cur_seed)
                    if cur_score > cur_best_score:
                        cur_best_score = cur_score
                        cur_best_path = cur_image_path
                    if PERFORMANCE:
                        print(run_num, cur_score - og_score)

                og_img = Image.open(og_file_path)
                cur_meta = og_img.getexif()
                final_path = self._move_image(cur_best_path, og_file_path, cur_meta)
                clip_diff = cur_best_score - og_score
                print("B", clip_diff, cur_best_score)

                is_success = check_clip_threshold(self.params, clip_diff)
                if not is_success:
                    error_code = f"{clip_diff:.4f}".split(".")[-1]
                    error_logs.append(
                        f"Warning: weak protection for {os.path.basename(og_file_path)}. "
                        f"Try increasing intensity/render quality. CODE: {error_code}"
                    )
                    error_path = os.path.join(
                        self.output_dir,
                        "INCOMPLETE-" + os.path.basename(final_path),
                    )
                    if os.path.exists(error_path):
                        os.remove(error_path)
                    import shutil
                    shutil.move(final_path, error_path)
                    final_path = error_path

                final_path_ls.append(final_path)

        is_error = False
        outf = os.path.join(self.output_dir, "error.txt")
        if os.path.exists(outf):
            os.remove(outf)
        if len(error_logs) > 1:
            with open(outf, "w+") as f:
                f.write("\n".join(error_logs))
            is_error = True

        self._clean_tmp()
        return final_path_ls, is_error

    # ------------------------------------------------------------------
    # Single-run processing
    # ------------------------------------------------------------------
    def generate_one_run(
        self,
        image_data_ls: list[Image.Image],
        legit_image_paths: list[str],
        run_num: int,
    ) -> tuple[list[str], list[str]]:
        final_path_ls: list[str] = []
        self.tot_num_imgs = len(image_data_ls)

        for idx in range(len(image_data_ls)):
            if self.params["opt_setting"] == "0":
                self._emit(f"Generating preview for image {idx+1}/{len(image_data_ls)}")
            else:
                self._emit(f"Glazing image {idx+1}/{len(image_data_ls)}")

            cur_img = image_data_ls[idx]
            target_path = os.path.join(
                self.project_root_path, f"target-{idx}-{run_num}.jpg"
            )
            cur_target = Image.open(target_path)

            if cur_target.size != cur_img.size:
                raise ValueError("Target and source size mismatch")

            self.cur_img_idx = idx
            res_cloaked_imgs = self._generate_one_image(cur_img, cur_target)
            assert len(res_cloaked_imgs) == 1

            og_image_path = legit_image_paths[idx]
            tmp_path = self._save_image(res_cloaked_imgs[0], og_image_path, tmp=True, run_num=run_num)
            final_path_ls.append(tmp_path)

        return final_path_ls, legit_image_paths

    # ------------------------------------------------------------------
    # Single-image processing
    # ------------------------------------------------------------------
    def _generate_one_image(
        self, cur_img: Image.Image, cur_target: Image.Image
    ) -> list[Image.Image]:
        cur_img_array = np.array(cur_img).astype(np.float32)
        segments, last_idx, square_size = self._segment_img(cur_img)
        target_segments, _, _ = self._segment_img(cur_target)

        res_adv_list = self._compute_512_adv_tensor(
            segments, target_segments, [square_size] * len(segments)
        )

        cloaked_array = self._put_back_cloak(cur_img_array, res_adv_list, last_idx, square_size)
        return [Image.fromarray(cloaked_array.astype(np.uint8))]

    # ------------------------------------------------------------------
    # Style transfer target generation
    # ------------------------------------------------------------------
    def extract_all_targets(self, image_data_ls: list[Image.Image]) -> None:
        for idx, cur_img in enumerate(image_data_ls):
            self._emit(
                f"Analyzing images (~{3 * self.params['n_runs']} min per image)..."
            )
            for r in range(self.params["n_runs"]):
                cur_target_img = self._style_transfer(cur_img)
                cur_target_img.save(
                    os.path.join(self.project_root_path, f"target-{idx}-{r}.jpg")
                )

        # Free SD model after all targets are generated
        if self.stable_diffusion_model is not None:
            self.stable_diffusion_model.to("cpu")
            del self.stable_diffusion_model
            self.stable_diffusion_model = None
            gc.collect()

    def _style_transfer(self, cur_img: Image.Image) -> Image.Image:
        if self.params["opt_setting"] == "0":
            return cur_img
        if self.stable_diffusion_model is None:
            self.stable_diffusion_model = self.load_model()

        n_run = self.params["style_transfer_iter"]
        prompts = [self.target_params["style"]]
        strength = self.target_params["strength"]

        img_copy = cur_img.copy()
        img_copy.thumbnail((512, 512), Image.LANCZOS)

        canvas = np.zeros((512, 512, 3), dtype=np.uint8)
        canvas[: img_copy.size[1], : img_copy.size[0], :] += np.array(img_copy)
        padded_img = Image.fromarray(canvas)
        img_tensor = img2tensor(padded_img, device=self.device)

        with torch.no_grad():
            target_img = self.stable_diffusion_model(
                prompts, img_tensor, strength, 7.5, n_run
            ).images[0]

        cropped = np.array(target_img)[: img_copy.size[1], : img_copy.size[0], :]
        cropped_img = Image.fromarray(cropped)
        return cropped_img.resize(cur_img.size)

    # ------------------------------------------------------------------
    # Adversarial optimisation
    # ------------------------------------------------------------------
    def _compute_512_adv_tensor(
        self,
        all_segments: list[Image.Image],
        all_target_segments: list[Image.Image],
        square_size_dup_ls: list[int],
    ) -> list:
        res_adv_list = []
        for seg_idx in range(len(all_segments)):
            cur_square_size = square_size_dup_ls[seg_idx]
            seg_start = time.time()

            res_adv_tensors = self._compute_batch(
                [all_segments[seg_idx]],
                [all_target_segments[seg_idx]],
                cur_square_size,
                seg_idx,
                len(all_segments),
            )

            seg_time = time.time() - seg_start
            print(f"Segment process time: {seg_time:.1f}s")

            for t in res_adv_tensors:
                res_adv_list.append(t)

        return res_adv_list

    def _compute_batch(
        self,
        cur_batch: list[Image.Image],
        target_batch: list[Image.Image],
        cur_square_size: int,
        seg_idx: int,
        tot_seg_length: int,
    ):
        cur_batch_t = [img2tensor(img, self.device) for img in cur_batch]
        cur_targets_t = [img2tensor(img, self.device) for img in target_batch]
        max_change = self.params["max_change"]
        tot_steps = self.params["tot_steps"]

        if self.half:
            source_image_tensors = [x.half() for x in cur_batch_t]
            target_image_tensors = [x.half() for x in cur_targets_t]
        else:
            source_image_tensors = cur_batch_t
            target_image_tensors = cur_targets_t

        source_batch = torch.cat(source_image_tensors, dim=0)
        target_batch_t = torch.cat(target_image_tensors, dim=0)

        # Preview mode: use pre-computed mask
        if self.params["opt_setting"] == "0":
            preview_mask = pickle.load(
                open(os.path.join(self.project_root_path, "preview_mask.p"), "rb")
            )
            preview_mask_tensor = torch.tensor(
                preview_mask, dtype=source_batch.dtype
            ).to(self.device)
            preview_mask_tensor = (preview_mask_tensor / 0.05) * max_change * 1.2
            cloaked_batch = torch.clamp(source_batch + preview_mask_tensor, -1, 1)
            return cloaked_batch

        # Full optimisation
        X_batch = source_batch.clone().detach().to(self.device)

        with torch.no_grad():
            target_emb = self.model_encode(target_batch_t).detach()

        resizer_large = torchvision.transforms.Resize(cur_square_size)
        resizer_512 = torchvision.transforms.Resize((512, 512))

        step_size = max_change * (0.5 if tot_steps > 10 else 0.75)
        modifiers = torch.zeros_like(X_batch)

        for i in range(tot_steps):
            actual_step_size = step_size * (1 - (100 * (i / tot_steps)))

            # Progress reporting
            tot_seg2 = 2 * self.tot_runs * self.tot_num_imgs
            cur_p = (
                (i / tot_steps) * 100 * (tot_seg2 / max(self.num_segments_went_through, 1))
            ) + (100 * (tot_seg2 / self.tot_num_imgs))
            self._emit(f"glazetp={cur_p:.2f}")

            modifiers.requires_grad_(True)
            X_adv = torch.clamp(modifiers + X_batch, -1, 1)
            X_adv = resizer_large(X_adv)
            X_adv = resizer_512(X_adv)

            loss = (self.model_encode(X_adv) - target_emb).norm()
            grad = torch.autograd.grad(loss, modifiers)[0]

            grad = grad.detach()
            modifiers = modifiers.detach()

            modifiers = modifiers - grad.sign() * actual_step_size
            modifiers = torch.clamp(modifiers, -max_change, max_change)

        best_modifier_t = modifiers.detach()
        if self.half:
            best_modifier_t = best_modifier_t.half()
        best_adv_tensors = torch.clamp(best_modifier_t + X_batch, -1, 1)

        self.num_segments_went_through += 1
        return best_adv_tensors

    # ------------------------------------------------------------------
    # Image segmentation & reassembly
    # ------------------------------------------------------------------
    def _segment_img(
        self, cur_img: Image.Image
    ) -> tuple[list[Image.Image], int, int]:
        """Split image into overlapping 512×512 square segments."""
        arr = np.array(cur_img).astype(np.float32)
        og_width, og_height = cur_img.size
        short_height = og_height <= og_width

        squares: list[Image.Image] = []
        last_index = 0

        if short_height:
            square_size = og_height
            cur_idx = 0
            while True:
                if cur_idx + og_height < og_width:
                    crop = arr[0:og_height, cur_idx : cur_idx + og_height, :]
                else:
                    crop = arr[0:og_height, -og_height:, :]
                    last_index = og_height - (og_width - cur_idx)
                sq = Image.fromarray(crop.astype(np.uint8)).resize((512, 512))
                squares.append(sq)
                cur_idx += og_height
                if cur_idx >= og_width:
                    break
        else:
            square_size = og_width
            cur_idx = 0
            while True:
                if cur_idx + og_width < og_height:
                    crop = arr[cur_idx : cur_idx + og_width, 0:og_width, :]
                else:
                    crop = arr[-og_width:, 0:og_width, :]
                    last_index = og_width - (og_height - cur_idx)
                sq = Image.fromarray(crop.astype(np.uint8)).resize((512, 512))
                squares.append(sq)
                cur_idx += og_width
                if cur_idx >= og_height:
                    break

        return squares, last_index, square_size

    def _get_cloak(
        self,
        og_segment_img: Image.Image,
        res_adv_tensor: torch.Tensor,
        square_size: int,
    ) -> np.ndarray:
        resize_back = og_segment_img.resize((square_size, square_size))
        res_adv_img = tensor2img(res_adv_tensor).resize((square_size, square_size))
        return np.array(res_adv_img).astype(np.float32) - np.array(resize_back).astype(
            np.float32
        )

    def _put_back_cloak(
        self,
        og_img_array: np.ndarray,
        cloak_tensors: list,
        last_index: int,
        square_size: int,
    ) -> np.ndarray:
        """Reassemble cloaked segments back onto the original image array."""
        og_height, og_width, _ = og_img_array.shape
        short_height = og_height <= og_width

        # Convert tensors → cloak diffs at original resolution
        cloak_list = []
        for t in cloak_tensors:
            adv_img = tensor2img(t).resize((square_size, square_size))
            cloak_list.append(np.array(adv_img).astype(np.float32))

        if short_height:
            for idx, cloak in enumerate(cloak_list):
                # Build the original segment for this position
                if idx < len(cloak_list) - 1:
                    orig_seg = og_img_array[0:og_height, idx * og_height : (idx + 1) * og_height, :]
                    orig_resized = np.array(
                        Image.fromarray(orig_seg.astype(np.uint8)).resize((square_size, square_size))
                    ).astype(np.float32)
                    diff = cloak - orig_resized
                    # Resize diff back and apply
                    diff_img = Image.fromarray(
                        np.clip(diff + 128, 0, 255).astype(np.uint8)
                    ).resize((og_height, og_height))
                    diff_back = np.array(diff_img).astype(np.float32) - 128
                    og_img_array[0:og_height, idx * og_height : (idx + 1) * og_height, :] += diff_back
                else:
                    orig_seg = og_img_array[0:og_height, -og_height:, :]
                    orig_resized = np.array(
                        Image.fromarray(orig_seg.astype(np.uint8)).resize((square_size, square_size))
                    ).astype(np.float32)
                    diff = cloak - orig_resized
                    diff_img = Image.fromarray(
                        np.clip(diff + 128, 0, 255).astype(np.uint8)
                    ).resize((og_height, og_height))
                    diff_back = np.array(diff_img).astype(np.float32) - 128
                    og_img_array[0:og_height, -og_height:, :] += diff_back
        else:
            for idx, cloak in enumerate(cloak_list):
                if idx < len(cloak_list) - 1:
                    orig_seg = og_img_array[idx * og_width : (idx + 1) * og_width, 0:og_width, :]
                    orig_resized = np.array(
                        Image.fromarray(orig_seg.astype(np.uint8)).resize((square_size, square_size))
                    ).astype(np.float32)
                    diff = cloak - orig_resized
                    diff_img = Image.fromarray(
                        np.clip(diff + 128, 0, 255).astype(np.uint8)
                    ).resize((og_width, og_width))
                    diff_back = np.array(diff_img).astype(np.float32) - 128
                    og_img_array[idx * og_width : (idx + 1) * og_width, 0:og_width, :] += diff_back
                else:
                    orig_seg = og_img_array[-og_width:, 0:og_width, :]
                    orig_resized = np.array(
                        Image.fromarray(orig_seg.astype(np.uint8)).resize((square_size, square_size))
                    ).astype(np.float32)
                    diff = cloak - orig_resized
                    diff_img = Image.fromarray(
                        np.clip(diff + 128, 0, 255).astype(np.uint8)
                    ).resize((og_width, og_width))
                    diff_back = np.array(diff_img).astype(np.float32) - 128
                    og_img_array[-og_width:, 0:og_width, :] += diff_back

        return np.clip(og_img_array, 0, 255)

    # ------------------------------------------------------------------
    # File helpers
    # ------------------------------------------------------------------
    def _save_image(
        self,
        cur_cloak_img: Image.Image,
        og_image_path: str,
        tmp: bool = False,
        run_num: int = 0,
    ) -> str:
        fpath = self._cal_target_file_name(og_image_path, tmp, run_num)
        if cur_cloak_img.size == (512, 512):
            fpath += ".png"
        if fpath.endswith(".png"):
            cur_cloak_img.save(fpath, format="PNG")
        else:
            cur_cloak_img.save(fpath, format="JPEG", quality=100)
        return fpath

    def _move_image(self, tmp_path: str, og_file_path: str, meta) -> str:
        target_path = self._cal_target_file_name(og_file_path, tmp=False, run_num=0)
        if os.path.exists(target_path):
            os.remove(target_path)
        tmp_img = Image.open(tmp_path)
        tmp_img.save(target_path, exif=meta, quality=100)
        return target_path

    def _cal_target_file_name(
        self, og_image_path: str, tmp: bool, run_num: int
    ) -> str:
        if tmp:
            cur_dir = os.path.join(self.project_root_path, "tmp")
            os.makedirs(cur_dir, exist_ok=True)
        elif self.output_dir and os.path.exists(self.output_dir):
            cur_dir = self.output_dir
        else:
            raise ValueError("Cannot locate output folder")

        og_name = os.path.basename(og_image_path)
        if "." in og_name:
            parts = og_name.rsplit(".", 1)
            name_first, name_ext = parts[0], parts[1]
        else:
            name_first, name_ext = og_name, None

        setting = self.params["setting"]
        opt = self.params["opt_setting"] if self.params["opt_setting"] != "0" else "-preview"
        glazed_name = f"{name_first}-glazed-intensity{setting}-render{opt}"
        if tmp:
            glazed_name += f"-run{run_num}"
        if name_ext:
            glazed_name += f".{name_ext}"

        return os.path.join(cur_dir, glazed_name)

    def _clean_tmp(self):
        if PERFORMANCE or self.params["opt_setting"] == "0":
            return
        import glob as g

        for f in g.glob(os.path.join(self.project_root_path, "tmp/*")):
            os.remove(f)
        for f in g.glob(os.path.join(self.project_root_path, "target-*.jpg")):
            os.remove(f)
