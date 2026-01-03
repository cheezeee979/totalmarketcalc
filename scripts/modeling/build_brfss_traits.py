"""
Build modeled trait probabilities from BRFSS 2024 microdata.

Steps:
- Load the ACS cell backbone (data/derived/acs_cells.json).
- Detect the latest BRFSS XPT file under data/raw/brfss/2024/.
- Normalize sex, age_band, and region (from state FIPS → Census region).
- Fit weighted logistic regressions for each configured trait.
- Predict probabilities for every ACS cell and write JSON artifacts to data/derived/traits/.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import pyreadstat
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "traits" / "brfss_2024.json"
STATE_REGION_PATH = ROOT / "config" / "traits" / "state_regions.json"
ACS_CELLS_PATH = ROOT / "data" / "derived" / "acs_cells.json"
TRAIT_OUTPUT_DIR = ROOT / "data" / "derived" / "traits"
PUBLIC_OUTPUT_DIR = ROOT / "public" / "data" / "derived" / "traits"


@dataclass
class TraitConfig:
    key: str
    label: str
    source: str
    universe: str
    type: str
    definition_notes: str
    label_rule: dict
    weight_vars: List[str]
    sex_vars: List[str]
    age_vars: List[str]
    state_vars: List[str]


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_columns(df: pd.DataFrame) -> Dict[str, str]:
    """Map uppercase column names to their original case for easy lookup."""
    return {col.upper(): col for col in df.columns}


def select_column(columns: Dict[str, str], candidates: List[str], label: str) -> str:
    for name in candidates:
        existing = columns.get(name.upper())
        if existing:
            return existing
    raise KeyError(f"Could not find column for {label}. Tried: {', '.join(candidates)}")


def to_age_band(value: float) -> Optional[str]:
    """Map BRFSS _AGEG5YR code into aggregated bands."""
    if pd.isna(value):
        return None
    code = int(value)
    if code == 1:
        return "18_24"
    if code in (2, 3):
        return "25_34"
    if code in (4, 5):
        return "35_44"
    if code in (6, 7):
        return "45_54"
    if code in (8, 9):
        return "55_64"
    if code >= 10:
        return "65_plus"
    return None


def to_sex(value: float) -> Optional[str]:
    if pd.isna(value):
        return None
    code = int(value)
    if code == 1:
        return "male"
    if code == 2:
        return "female"
    return None


def load_brfss_dataframe(xpt_path: Path) -> pd.DataFrame:
    print(f"Reading BRFSS XPT: {xpt_path}")
    try:
      # Prefer pandas for broader encoding support
        return pd.read_sas(xpt_path, format="xport", encoding="latin-1")
    except Exception as first_err:
        print(f"Pandas read_sas failed ({first_err}); retrying with pyreadstat.")
        df, _ = pyreadstat.read_xport(xpt_path)
        return df


def derive_smoking(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    preferred_vars = rule.get("preferred_vars", [])
    fallback_vars = rule.get("fallback", [])

    for var in preferred_vars:
        col = columns.get(var.upper())
        if col:
            val = row[col]
            if pd.isna(val):
                continue
            code = int(val)
            if code == 1:  # Current smoker recode
                return 1
            if code in (2, 3, 4):  # Former/never or nonsmoker recodes
                return 0
            continue

    # Fallback: SMOKE100 + SMOKDAY2
    smoke100_col = columns.get("SMOKE100")
    smokday2_col = columns.get("SMOKDAY2")
    if smoke100_col and smokday2_col:
        smoke100 = row[smoke100_col]
        smokday2 = row[smokday2_col]
        if pd.isna(smoke100) or pd.isna(smokday2):
            return None
        smoke100 = int(smoke100)
        smokday2 = int(smokday2)
        if smoke100 == 1 and smokday2 in (1, 2):
            return 1
        if smoke100 in (2,) or smokday2 == 3:
            return 0
    return None


def derive_activity(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    for var in rule.get("preferred_vars", []):
        col = columns.get(var.upper())
        if not col:
            continue
        val = row[col]
        if pd.isna(val):
            continue
        code = int(val)
        if code == 1:  # Yes, active
            return 1
        if code == 2:  # No
            return 0
    return None


def fit_logit(df: pd.DataFrame, label_col: str, weight_col: str):
    feature_cols = ["sex_key", "age_band", "region_key"]
    dummies = pd.get_dummies(df[feature_cols], drop_first=True)
    design = sm.add_constant(dummies, has_constant="add").astype(float)
    y = pd.to_numeric(df[label_col], errors="coerce").astype(float)
    weights = pd.to_numeric(df[weight_col], errors="coerce").astype(float)
    model = sm.GLM(y, design, family=sm.families.Binomial(), freq_weights=weights)
    result = model.fit()
    return result, design.columns


def predict_for_cells(result, design_columns, cells: pd.DataFrame):
    cell_dummies = pd.get_dummies(cells[["sex_key", "age_band", "region_key"]], drop_first=True)
    cell_design = sm.add_constant(cell_dummies, has_constant="add").astype(float)
    cell_design = cell_design.reindex(columns=design_columns, fill_value=0)
    preds = result.predict(cell_design)
    preds = np.clip(preds, 0, 1)
    return preds


def write_trait_output(trait_key: str, meta: dict, prob_by_cell: Dict[str, float]):
    TRAIT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    payload = {"meta": meta, "prob_by_cell": prob_by_cell}
    out_path = TRAIT_OUTPUT_DIR / f"{trait_key}.json"
    pub_path = PUBLIC_OUTPUT_DIR / f"{trait_key}.json"

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    pub_path.write_text(out_path.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Wrote trait probabilities: {out_path}")


def main():
    config_json = load_json(CONFIG_PATH)
    state_regions = load_json(STATE_REGION_PATH)
    acs_cells = load_json(ACS_CELLS_PATH)

    traits = [TraitConfig(**t) for t in config_json.get("traits", [])]
    xpt_dir = ROOT / "data" / "raw" / "brfss" / "2024"
    xpt_files = sorted(xpt_dir.glob("*.xpt")) + sorted(xpt_dir.glob("*.XPT"))
    if not xpt_files:
        raise FileNotFoundError(f"No BRFSS XPT files found in {xpt_dir}")

    xpt_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    xpt_path = xpt_files[0]

    df = load_brfss_dataframe(xpt_path)
    columns = normalize_columns(df)

    weight_col = select_column(columns, traits[0].weight_vars, "weight")
    sex_col = select_column(columns, traits[0].sex_vars, "sex")
    age_col = select_column(columns, traits[0].age_vars, "age")
    state_col = select_column(columns, traits[0].state_vars, "state")

    base_cols = {weight_col, sex_col, age_col, state_col}
    needed_trait_vars = []
    for trait in traits:
        needed_trait_vars.extend(trait.label_rule.get("preferred_vars", []))
        needed_trait_vars.extend(trait.label_rule.get("fallback", []))

    selected_cols = [columns[c.upper()] for c in needed_trait_vars if c.upper() in columns] + list(base_cols)
    df = df[selected_cols].copy()

    # Coerce numeric codes before recoding
    for col in [weight_col, sex_col, age_col, state_col, *selected_cols]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["weight"] = df[weight_col].apply(lambda x: float(x) if pd.notna(x) else np.nan)
    df["sex_key"] = df[sex_col].apply(to_sex)
    df["age_band"] = df[age_col].apply(to_age_band)
    df["region_key"] = df[state_col].apply(lambda x: state_regions.get(str(int(x)).zfill(2)) if pd.notna(x) else None)
    df = df[df["weight"].notna() & (df["weight"] > 0)]

    for trait in traits:
        print(f"\nModeling trait: {trait.label} ({trait.key})")
        if trait.key == "smokes":
            df[trait.key] = df.apply(lambda row: derive_smoking(row, trait.label_rule, columns), axis=1)
        elif trait.key == "physically_active":
            df[trait.key] = df.apply(lambda row: derive_activity(row, trait.label_rule, columns), axis=1)
        else:
            print(f"Skipping unknown trait key: {trait.key}")
            continue

        trait_df = df.dropna(subset=[trait.key, "sex_key", "age_band", "region_key"]).copy()
        trait_df[trait.key] = pd.to_numeric(trait_df[trait.key], errors="coerce")
        trait_df["weight"] = pd.to_numeric(trait_df["weight"], errors="coerce")
        if trait_df.empty:
            raise RuntimeError(f"No usable records for trait {trait.key}")

        model_df = trait_df[["sex_key", "age_band", "region_key", "weight", trait.key]].copy()
        result, design_columns = fit_logit(model_df, trait.key, "weight")
        print(result.summary())

        cells_df = pd.DataFrame(acs_cells["cells"])
        cells_df = cells_df.rename(columns={"sex": "sex_key", "region": "region_key"})
        preds = predict_for_cells(result, design_columns, cells_df[["sex_key", "age_band", "region_key"]])

        prob_by_cell = {cell_id: float(round(prob, 6)) for cell_id, prob in zip(cells_df["cell_id"], preds)}
        meta = {
            "source": trait.source,
            "year": 2024,
            "method": "weighted_logit",
            "features": ["sex", "age_band", "region"],
            "generatedAt": pd.Timestamp.utcnow().isoformat(),
            "definition": trait.definition_notes,
        }
        write_trait_output(trait.key, meta, prob_by_cell)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Failed to build BRFSS traits: {exc}")
        sys.exit(1)
