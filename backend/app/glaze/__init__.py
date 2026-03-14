"""Glaze – adversarial image protection against AI style-mimicry.

Adapted from https://github.com/EspacioLatente/Glaze (archived).
Original code by University of Chicago SAND Lab.
Fixed decompilation artifacts, removed PyQt5 dependency, added MPS support.
"""

from app.glaze.glazing import Glaze  # noqa: F401
from app.glaze.downloader import download_all_resources  # noqa: F401
