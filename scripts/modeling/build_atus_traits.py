"""
Build modeled probabilities from ATUS respondent + activity summary data.

Outputs:
- data/derived/traits/high_childcare_time.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "traits" / "atus.json"
ACS_CELLS_PATH = ROOT / "data" / "derived" / "acs_cells.json"
TRAIT_OUTPUT_DIR = ROOT / "data" / "derived" / "traits"
PUBLIC_OUTPUT_DIR = ROOT / "public" / "data" / "derived" / "traits"


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def select_column(df: pd.DataFrame, candidates: List[str], label: str) -> str:
    normalized = {col.upper(): col for col in df.columns}
    for candidate in candidates:
        found = normalized.get(candidate.upper())
        if found:
            return found
    raise KeyError(f"Could not find column for {label}. Tried: {', '.join(candidates)}")


def detect_caseid(resp_df: pd.DataFrame, sum_df: pd.DataFrame) -> str:
    candidates = ["TUCASEID", "TUCASE_ID", "TUID"]
    for cand in candidates:
        if cand in resp_df.columns and cand in sum_df.columns:
            return cand
    overlap = set(resp_df.columns) & set(sum_df.columns)
    if overlap:
        return sorted(overlap)[0]
    raise KeyError("Could not detect respondent ID column shared by ATUS respondent and summary files.")


def to_age_band(age: float) -> Optional[str]:
    if pd.isna(age):
        return None
    age_int = int(age)
    if age_int < 18:
        return None
    if 18 <= age_int <= 24:
        return "18_24"
    if 25 <= age_int <= 34:
        return "25_34"
    if 35 <= age_int <= 44:
        return "35_44"
    if 45 <= age_int <= 54:
        return "45_54"
    if 55 <= age_int <= 64:
        return "55_64"
    return "65_plus"


def to_sex(value: float) -> Optional[str]:
    if pd.isna(value):
        return None
    code = int(value)
    if code == 1:
        return "male"
    if code == 2:
        return "female"
    return None


def to_region_from_code(value: float) -> Optional[str]:
    if pd.isna(value):
        return None
    code = int(value)
    mapping = {1: "northeast", 2: "midwest", 3: "south", 4: "west"}
    return mapping.get(code)


def sum_childcare_minutes(df: pd.DataFrame) -> (pd.Series, List[str]):
    childcare_cols = [c for c in df.columns if re.match(r"(?i)^t0301", c)]
    if not childcare_cols:
        childcare_cols = [c for c in df.columns if re.match(r"(?i)^t03", c)]
    if not childcare_cols:
        raise KeyError("Could not find childcare-related columns (t0301* or t03*) in ATUS summary data.")
    df[childcare_cols] = df[childcare_cols].apply(pd.to_numeric, errors="coerce")
    minutes = df[childcare_cols].fillna(0).sum(axis=1)
    return minutes, childcare_cols


def fit_logit(df: pd.DataFrame, label_col: str, weight_col: str, include_region: bool):
    feature_cols = ["sex_key", "age_band"]
    if include_region:
        feature_cols.append("region_key")
    dummies = pd.get_dummies(df[feature_cols], drop_first=True).astype(float)
    design = sm.add_constant(dummies, has_constant="add").astype(float)
    y = pd.to_numeric(df[label_col], errors="coerce").astype(float)
    weights = pd.to_numeric(df[weight_col], errors="coerce").astype(float)
    model = sm.GLM(y, design, family=sm.families.Binomial(), freq_weights=weights)
    result = model.fit()
    return result, design.columns, feature_cols


def predict_for_cells(result, design_columns, cells: pd.DataFrame):
    dummies = pd.get_dummies(cells, drop_first=True)
    design = sm.add_constant(dummies, has_constant="add").astype(float)
    design = design.reindex(columns=design_columns, fill_value=0)
    preds = result.predict(design)
    return np.clip(preds, 0, 1)


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
    config = load_json(CONFIG_PATH)
    acs_cells = load_json(ACS_CELLS_PATH)
    trait = config["traits"][0]

    data_dir = ROOT / "data" / "raw" / "atus"
    resp_files = sorted(data_dir.glob("*atusresp*.csv")) or sorted(data_dir.glob("*atusresp*.dat"))
    sum_files = sorted(data_dir.glob("*atussum*.csv")) or sorted(data_dir.glob("*atussum*.dat"))
    if not resp_files or not sum_files:
        raise FileNotFoundError(f"Expected ATUS respondent and summary CSV files under {data_dir}")

    resp_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    sum_files.sort(key=lambda p: p.stat().st_size, reverse=True)

    resp_df = pd.read_csv(resp_files[0], low_memory=False)
    sum_df = pd.read_csv(sum_files[0], low_memory=False)

    case_col = detect_caseid(resp_df, sum_df)
    merged = pd.merge(resp_df, sum_df, on=case_col, how="inner", suffixes=("", "_sum"))

    weight_col = select_column(merged, trait["weight_vars"], "weight")
    sex_col = select_column(merged, trait["sex_vars"], "sex")
    age_col = select_column(merged, trait["age_vars"], "age")
    region_col: Optional[str] = None
    include_region = False
    for cand in trait.get("region_vars", []):
        try:
            region_col = select_column(merged, [cand], "region")
            include_region = True
            break
        except KeyError:
            continue

    # Coerce numeric codes now that columns are known
    for col in [weight_col, sex_col, age_col, region_col] if include_region else [weight_col, sex_col, age_col]:
        if col and col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")

    merged["weight"] = merged[weight_col].apply(lambda x: float(x) if pd.notna(x) else np.nan)
    merged["sex_key"] = merged[sex_col].apply(to_sex)
    merged["age_band"] = merged[age_col].apply(to_age_band)
    if include_region and region_col:
        merged["region_key"] = merged[region_col].apply(to_region_from_code)
    else:
        merged["region_key"] = None

    childcare_minutes, childcare_cols = sum_childcare_minutes(merged)
    merged["childcare_minutes"] = childcare_minutes
    merged["high_childcare_time"] = (merged["childcare_minutes"] >= trait["label_rule"]["threshold_minutes"]).astype(int)

    keep_mask = (
        merged["weight"].notna()
        & (merged["weight"] > 0)
        & merged["sex_key"].notna()
        & merged["age_band"].notna()
    )
    if include_region:
        keep_mask &= merged["region_key"].notna()

    model_df = merged.loc[keep_mask, ["sex_key", "age_band", "region_key", "weight", "high_childcare_time"]].copy()
    if model_df.empty and include_region:
        print("No usable ATUS records with region; retrying without region term.")
        include_region = False
        merged["region_key"] = "nationwide"
        keep_mask = (
            merged["weight"].notna()
            & (merged["weight"] > 0)
            & merged["sex_key"].notna()
            & merged["age_band"].notna()
        )
        model_df = merged.loc[keep_mask, ["sex_key", "age_band", "region_key", "weight", "high_childcare_time"]].copy()
    if model_df.empty:
        raise RuntimeError("No usable ATUS records after filtering.")

    model_df["high_childcare_time"] = pd.to_numeric(model_df["high_childcare_time"], errors="coerce").astype(float)
    model_df["weight"] = pd.to_numeric(model_df["weight"], errors="coerce").astype(float)

    result, design_columns, feature_cols = fit_logit(
        model_df,
        "high_childcare_time",
        "weight",
        include_region=include_region,
    )
    print(result.summary())

    cells_df = pd.DataFrame(acs_cells["cells"])[["cell_id", "sex", "age_band", "region"]].copy()
    cells_df = cells_df.rename(columns={"sex": "sex_key", "region": "region_key"})
    if not include_region:
        cells_df["region_key"] = "nationwide"
        model_df["region_key"] = "nationwide"

    preds = predict_for_cells(result, design_columns, cells_df[["sex_key", "age_band", "region_key"]])
    prob_by_cell = {cell_id: float(round(prob, 6)) for cell_id, prob in zip(cells_df["cell_id"], preds)}

    meta = {
        "source": trait["source"],
        "year": 2024,
        "method": "weighted_logit",
        "features": feature_cols,
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "definition": trait["definition_notes"],
        "childcare_columns": childcare_cols,
        "notes": "Region term excluded because no usable region column was present."
        if not include_region
        else "Region derived from ATUS region code.",
    }
    write_trait_output(trait["key"], meta, prob_by_cell)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Failed to build ATUS traits: {exc}")
        sys.exit(1)
