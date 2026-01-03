"""
Validate modeled trait outputs and write a manifest for the frontend.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ACS_CELLS_PATH = ROOT / "data" / "derived" / "acs_cells.json"
TRAIT_DIR = ROOT / "data" / "derived" / "traits"
PUBLIC_TRAIT_DIR = ROOT / "public" / "data" / "derived" / "traits"
MANIFEST_PATH = ROOT / "data" / "derived" / "traits_manifest.json"
PUBLIC_MANIFEST_PATH = ROOT / "public" / "data" / "derived" / "traits_manifest.json"
CONFIG_FILES = [
    ROOT / "config" / "traits" / "brfss_2024.json",
    ROOT / "config" / "traits" / "atus.json",
]


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main():
    acs_cells = load_json(ACS_CELLS_PATH)
    cell_ids = {cell["cell_id"] for cell in acs_cells["cells"]}

    trait_configs: List[Dict] = []
    for cfg in CONFIG_FILES:
        trait_configs.extend(load_json(cfg).get("traits", []))

    manifest_traits = []

    for trait in trait_configs:
        trait_file = TRAIT_DIR / f"{trait['key']}.json"
        if not trait_file.exists():
            raise FileNotFoundError(
                f"Missing trait file {trait_file}. Run `npm run build:modeled-data` after placing raw survey files."
            )

        payload = load_json(trait_file)
        probs: Dict[str, float] = payload.get("prob_by_cell", {})
        missing = cell_ids - probs.keys()
        extra = probs.keys() - cell_ids
        if missing:
            raise ValueError(f"Trait {trait['key']} missing probabilities for cells: {sorted(list(missing))[:5]} ...")
        if extra:
            raise ValueError(f"Trait {trait['key']} has unexpected cell IDs: {sorted(list(extra))[:5]} ...")

        values = np.array(list(probs.values()), dtype=float)
        if np.any(values < 0) or np.any(values > 1):
            raise ValueError(f"Trait {trait['key']} contains probabilities outside [0,1].")

        print(
            f"{trait['key']}: min={values.min():.3f}, max={values.max():.3f}, mean={values.mean():.3f}, cells={len(values)}"
        )

        manifest_traits.append(
            {
                "key": trait["key"],
                "label": trait["label"],
                "source": trait["source"],
                "type": trait.get("type", "modeled"),
                "universe": trait.get("universe", ""),
                "definition_notes": trait.get("definition_notes", ""),
                "file": f"traits/{trait['key']}.json",
            }
        )

    manifest_payload = {"traits": manifest_traits, "generatedAt": acs_cells.get("meta", {}).get("generatedAt")}
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest_payload, f, indent=2)
    PUBLIC_MANIFEST_PATH.write_text(MANIFEST_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Wrote trait manifest: {MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Trait validation failed: {exc}")
        sys.exit(1)
