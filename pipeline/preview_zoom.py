import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PatchCollection
from matplotlib.patches import Polygon as MplPoly
from shapely.geometry import box, shape

with open("out/nyc_neighborhoods.geojson") as fh:
    fc = json.load(fh)
rng = np.random.default_rng(3)
views = {
    "Manhattan + N. Brooklyn": (-74.03, 40.68, -73.90, 40.83),
    "Brooklyn core": (-74.03, 40.60, -73.85, 40.73),
}

fig, axes = plt.subplots(1, 2, figsize=(26, 16))
for ax, (title, bb) in zip(axes, views.items(), strict=True):
    win = box(*bb)
    patches, colors, labels = [], [], []
    for f in fc["features"]:
        g = shape(f["geometry"])
        if not g.intersects(win):
            continue
        c = rng.random(3) * 0.65 + 0.3
        for gg in g.geoms if g.geom_type == "MultiPolygon" else [g]:
            patches.append(MplPoly(np.array(gg.exterior.coords)))
            colors.append(c)
        p = g.intersection(win).representative_point()
        labels.append((p.x, p.y, f["properties"]["name"], f["properties"]["people"]))
    ax.add_collection(PatchCollection(patches, facecolors=colors, edgecolor="white", linewidth=1.1))
    for x, y, name, conf in labels:
        ax.text(x, y, f"{name}\n{conf:.2f}", ha="center", va="center", fontsize=6.5)
    ax.set_xlim(bb[0], bb[2])
    ax.set_ylim(bb[1], bb[3])
    ax.set_aspect(1 / np.cos(np.radians(40.7)))
    ax.set_title(title, fontsize=15)
    ax.axis("off")
plt.tight_layout()
plt.savefig("out/preview_zoom.png", dpi=105, bbox_inches="tight")
print("ok")
