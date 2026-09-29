import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PatchCollection
from matplotlib.patches import Polygon as MplPoly
from shapely.geometry import shape

with open("out/nyc_neighborhoods.geojson") as fh:
    fc = json.load(fh)
rng = np.random.default_rng(7)

fig, axes = plt.subplots(1, 2, figsize=(30, 15))
for ax, mode in zip(axes, ["random", "people"], strict=True):
    patches, colors = [], []
    for f in fc["features"]:
        g = shape(f["geometry"])
        geoms = g.geoms if g.geom_type == "MultiPolygon" else [g]
        c = rng.random(3) * 0.7 + 0.25 if mode == "random" else None
        for gg in geoms:
            patches.append(MplPoly(np.array(gg.exterior.coords)))
            colors.append(c if mode == "random" else f["properties"]["people"])
    if mode == "random":
        pc = PatchCollection(patches, facecolors=colors, edgecolor="white", linewidth=0.4)
    else:
        pc = PatchCollection(patches, cmap="magma", edgecolor="white", linewidth=0.3)
        pc.set_array(np.array(colors))
        pc.set_clim(0, 90_000)
        fig.colorbar(pc, ax=ax, shrink=0.5, label="people (2020 census)")
    ax.add_collection(pc)
    ax.autoscale_view()
    ax.set_aspect(1 / np.cos(np.radians(40.7)))
    ax.set_title(
        f"NYC neighborhoods, 2020 NTAs ({len(fc['features'])}) - {mode}",
        fontsize=16,
    )
    ax.axis("off")

for f in fc["features"]:
    g = shape(f["geometry"])
    p = g.representative_point()
    if f["properties"]["area_mi2"] > 0.62:
        axes[0].text(
            p.x,
            p.y,
            f["properties"]["name"],
            ha="center",
            va="center",
            fontsize=4.2,
            color="black",
        )
plt.tight_layout()
plt.savefig("out/preview_step0.png", dpi=115, bbox_inches="tight")
print("wrote out/preview_step0.png")
