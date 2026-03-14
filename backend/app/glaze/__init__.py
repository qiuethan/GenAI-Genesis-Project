"""Glaze – adversarial image protection against AI style-mimicry.

Adapted from https://github.com/EspacioLatente/Glaze (archived).
Original code by University of Chicago SAND Lab.
Fixed decompilation artifacts, removed PyQt5 dependency, added MPS support.

Imports are lazy to avoid pulling in torch/diffusers at server startup.
Use: from app.glaze.glazing import Glaze
"""
