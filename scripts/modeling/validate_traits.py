"""
Validate modeled trait outputs and write a manifest for the frontend.

Validates:
- Every trait file exists and has all cell_ids
- All probabilities are finite and within [0,1]
- Implied national prevalence is within plausible bounds
- Generates traits_manifest.json with all metadata for UI
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


def is_child_age_band(age_band: str) -> bool:
    """Check if an age band is for children (under 18)."""
    return age_band in ("0_17", "0_14", "15_17")


def validate_prevalence(
    probs: Dict[str, float],
    cells: List[dict],
    trait_key: str,
    bounds: List[float],
) -> float:
    """
    Compute implied national prevalence on adult cells and validate bounds.
    Returns the computed prevalence.
    """
    min_prev, max_prev = bounds
    
    # Only use adult cells (exclude child age bands)
    adult_cells = [c for c in cells if not is_child_age_band(c["age_band"])]
    
    if not adult_cells:
        raise ValueError(f"Trait {trait_key}: No adult cells found")
    
    total_pop = sum(c["pop"] for c in adult_cells)
    weighted_sum = sum(
        c["pop"] * probs.get(c["cell_id"], 0)
        for c in adult_cells
    )
    
    prevalence = weighted_sum / total_pop if total_pop > 0 else 0
    
    if prevalence < min_prev or prevalence > max_prev:
        raise ValueError(
            f"Trait {trait_key}: Implied prevalence {prevalence:.2%} is outside bounds "
            f"[{min_prev:.0%}, {max_prev:.0%}]. "
            f"This likely indicates label inversion or incorrect missing value handling."
        )
    
    return prevalence


def main():
    acs_data = load_json(ACS_CELLS_PATH)
    cells = acs_data["cells"]
    cell_ids = {cell["cell_id"] for cell in cells}
    
    print(f"Loaded ACS cells: {len(cells)} cells, {len(cell_ids)} unique IDs")

    trait_configs: List[Dict] = []
    for cfg_path in CONFIG_FILES:
        if cfg_path.exists():
            trait_configs.extend(load_json(cfg_path).get("traits", []))
    
    print(f"Found {len(trait_configs)} trait configurations")

    manifest_traits = []
    errors = []

    for trait in trait_configs:
        trait_key = trait["key"]
        trait_file = TRAIT_DIR / f"{trait_key}.json"
        
        print(f"\nValidating trait: {trait_key}")
        
        if not trait_file.exists():
            errors.append(
                f"Missing trait file {trait_file}. "
                f"Run `npm run build:traits` after placing raw survey files."
            )
            continue

        payload = load_json(trait_file)
        probs: Dict[str, float] = payload.get("prob_by_cell", {})
        meta = payload.get("meta", {})
        
        # Check cell ID coverage
        missing = cell_ids - probs.keys()
        extra = probs.keys() - cell_ids
        
        if missing:
            errors.append(
                f"Trait {trait_key} missing probabilities for cells: "
                f"{sorted(list(missing))[:5]}..."
            )
        if extra:
            errors.append(
                f"Trait {trait_key} has unexpected cell IDs: "
                f"{sorted(list(extra))[:5]}..."
            )

        # Check probability values
        values = np.array(list(probs.values()), dtype=float)
        
        if not np.all(np.isfinite(values)):
            non_finite = [k for k, v in probs.items() if not np.isfinite(v)]
            errors.append(
                f"Trait {trait_key} has non-finite probabilities: {non_finite[:5]}..."
            )
        
        if np.any(values < 0) or np.any(values > 1):
            out_of_bounds = [k for k, v in probs.items() if v < 0 or v > 1]
            errors.append(
                f"Trait {trait_key} has probabilities outside [0,1]: {out_of_bounds[:5]}..."
            )

        # Validate prevalence bounds
        bounds = trait.get("prevalence_bounds", [0.01, 0.50])
        try:
            prevalence = validate_prevalence(probs, cells, trait_key, bounds)
            print(f"  ✓ Prevalence: {prevalence:.2%} (bounds: {bounds[0]:.0%}-{bounds[1]:.0%})")
        except ValueError as e:
            errors.append(str(e))
            prevalence = 0

        print(
            f"  min={values.min():.4f}, max={values.max():.4f}, "
            f"mean={values.mean():.4f}, cells={len(values)}"
        )

        # Build manifest entry with all required fields
        manifest_entry = {
            "key": trait_key,
            "label": trait["label"],
            "group": trait.get("group", "Other"),
            "source": trait["source"],
            "minAge": trait.get("minAge", 18),
            "universeLabel": trait.get("universeLabel", "Adults 18+"),
            "regionSupport": meta.get("regionSupport", trait.get("regionSupport", "modeled")),
            "description": trait.get("description", trait.get("definition_notes", "")),
            "file": f"traits/{trait_key}.json",
        }
        manifest_traits.append(manifest_entry)

    if errors:
        print(f"\n{'='*60}")
        print("VALIDATION ERRORS:")
        print(f"{'='*60}")
        for err in errors:
            print(f"  ✗ {err}")
        print(f"\n{len(errors)} error(s) found. Build failed.")
        return 1

    # Write manifest
    manifest_payload = {
        "traits": manifest_traits,
        "generatedAt": acs_data.get("meta", {}).get("generatedAt"),
    }
    
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest_payload, f, indent=2)
    PUBLIC_MANIFEST_PATH.write_text(
        MANIFEST_PATH.read_text(encoding="utf-8"), encoding="utf-8"
    )
    
    print(f"\n{'='*60}")
    print(f"Validation passed! Wrote manifest with {len(manifest_traits)} traits.")
    print(f"{'='*60}")
    
    for t in manifest_traits:
        region_badge = "[National]" if t["regionSupport"] == "national_only" else "[Regional]"
        print(f"  • {t['key']}: {t['label']} {region_badge}")
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Trait validation failed: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
