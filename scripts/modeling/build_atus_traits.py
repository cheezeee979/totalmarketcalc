"""
Build modeled probabilities from ATUS respondent + activity summary data.

Outputs:
- data/derived/traits/high_childcare_time.json
- data/derived/traits/has_pet_proxy.json
- data/derived/traits/plays_sports.json
- data/derived/traits/spiritual_activities.json
- data/derived/traits/volunteer_work.json
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "traits" / "atus.json"
ACS_CELLS_PATH = ROOT / "data" / "derived" / "acs_cells.json"
TRAIT_OUTPUT_DIR = ROOT / "data" / "derived" / "traits"
PUBLIC_OUTPUT_DIR = ROOT / "public" / "data" / "derived" / "traits"


@dataclass
class TraitConfig:
    key: str
    label: str
    group: str
    source: str
    universe: str
    type: str
    definition_notes: str
    description: str
    label_rule: dict
    weight_vars: List[str]
    sex_vars: List[str]
    age_vars: List[str]
    region_vars: List[str]
    minAge: int = 18
    universeLabel: str = "Adults 18+"
    regionSupport: str = "national_only"
    prevalence_bounds: List[float] = field(default_factory=lambda: [0.01, 0.50])


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
        return None  # ATUS includes 15+, but we're limiting to 18+
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


def sum_time_columns(df: pd.DataFrame, patterns: List[str], label: str) -> Tuple[pd.Series, List[str]]:
    """
    Sum time-use columns matching the given regex patterns.
    Returns (minutes series, list of matched column names).
    """
    matched_cols = []
    for pattern in patterns:
        regex = re.compile(pattern, re.IGNORECASE)
        cols = [c for c in df.columns if regex.match(c)]
        matched_cols.extend(cols)
    
    matched_cols = list(set(matched_cols))  # Dedupe
    
    if not matched_cols:
        print(f"WARNING: No columns matched patterns {patterns} for {label}")
        return pd.Series([0] * len(df)), []
    
    print(f"  {label}: matched {len(matched_cols)} columns - {matched_cols[:5]}{'...' if len(matched_cols) > 5 else ''}")
    
    for col in matched_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    minutes = df[matched_cols].fillna(0).sum(axis=1)
    return minutes, matched_cols


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


def validate_probabilities(
    prob_by_cell: Dict[str, float], 
    cells_df: pd.DataFrame, 
    trait_key: str,
    bounds: List[float]
) -> float:
    """Validate probabilities and compute implied prevalence."""
    min_prev, max_prev = bounds
    
    for cell_id, prob in prob_by_cell.items():
        if not np.isfinite(prob):
            raise ValueError(f"Trait {trait_key}: probability for {cell_id} is not finite: {prob}")
        if prob < 0 or prob > 1:
            raise ValueError(f"Trait {trait_key}: probability for {cell_id} out of bounds [0,1]: {prob}")
    
    # Only use adult cells for prevalence calculation
    adult_cells = cells_df[cells_df["age_band"] != "0_17"].copy()
    
    if adult_cells.empty:
        raise ValueError(f"Trait {trait_key}: No adult cells found for prevalence calculation")
    
    total_pop = adult_cells["pop"].sum()
    weighted_sum = sum(
        adult_cells.loc[adult_cells["cell_id"] == cell_id, "pop"].iloc[0] * prob
        for cell_id, prob in prob_by_cell.items()
        if cell_id in adult_cells["cell_id"].values
    )
    
    prevalence = weighted_sum / total_pop if total_pop > 0 else 0
    
    print(f"  Implied national prevalence: {prevalence:.2%}")
    
    if prevalence < min_prev or prevalence > max_prev:
        raise ValueError(
            f"Trait {trait_key}: Implied prevalence {prevalence:.2%} is outside plausible bounds "
            f"[{min_prev:.0%}, {max_prev:.0%}]. "
            f"Check the column patterns and threshold for this trait."
        )
    
    return prevalence


def log_trait_summary(trait_key: str, trait_df: pd.DataFrame, weight_col: str):
    """Log weighted prevalence and data quality summary."""
    valid_rows = len(trait_df)
    weights = trait_df[weight_col]
    labels = trait_df[trait_key]
    
    total_weight = weights.sum()
    positive_weight = weights[labels == 1].sum()
    weighted_prevalence = positive_weight / total_weight if total_weight > 0 else 0
    
    print(f"  Data summary for {trait_key}:")
    print(f"    Valid rows: {valid_rows:,}")
    print(f"    Total weight: {total_weight:,.0f}")
    print(f"    Weighted prevalence (survey): {weighted_prevalence:.2%}")
    print(f"    Positive cases: {(labels == 1).sum():,} ({(labels == 1).mean():.1%} unweighted)")


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


def load_atus_data(data_dir: Path) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Load ATUS respondent and summary files."""
    # Try CSV first, then DAT files
    resp_files = sorted(data_dir.glob("*atusresp*.csv")) or sorted(data_dir.glob("*atusresp*.dat"))
    sum_files = sorted(data_dir.glob("*atussum*.csv")) or sorted(data_dir.glob("*atussum*.dat"))
    
    if not resp_files:
        raise FileNotFoundError(f"No ATUS respondent files found in {data_dir}")
    if not sum_files:
        raise FileNotFoundError(f"No ATUS summary files found in {data_dir}")
    
    # Use largest files (most recent year typically)
    resp_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    sum_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    
    resp_path = resp_files[0]
    sum_path = sum_files[0]
    
    print(f"Loading ATUS respondent file: {resp_path}")
    print(f"Loading ATUS summary file: {sum_path}")
    
    resp_df = pd.read_csv(resp_path, low_memory=False)
    sum_df = pd.read_csv(sum_path, low_memory=False)
    
    return resp_df, sum_df


def main():
    config = load_json(CONFIG_PATH)
    acs_cells = load_json(ACS_CELLS_PATH)
    
    traits = [TraitConfig(**t) for t in config.get("traits", [])]
    
    if not traits:
        print("No ATUS traits configured. Exiting.")
        return 0

    data_dir = ROOT / "data" / "raw" / "atus"
    resp_df, sum_df = load_atus_data(data_dir)
    
    case_col = detect_caseid(resp_df, sum_df)
    print(f"Using case ID column: {case_col}")
    
    merged = pd.merge(resp_df, sum_df, on=case_col, how="inner", suffixes=("", "_sum"))
    print(f"Merged dataset: {len(merged):,} rows")
    
    # Use first trait's config for common columns
    first_trait = traits[0]
    
    weight_col = select_column(merged, first_trait.weight_vars, "weight")
    sex_col = select_column(merged, first_trait.sex_vars, "sex")
    age_col = select_column(merged, first_trait.age_vars, "age")
    
    # Try to detect region column
    region_col: Optional[str] = None
    include_region = False
    for cand in first_trait.region_vars:
        try:
            region_col = select_column(merged, [cand], "region")
            include_region = True
            print(f"Using region column: {region_col}")
            break
        except KeyError:
            continue
    
    if not include_region:
        print("No region column found - will model nationally.")

    # Coerce numeric codes
    for col in [weight_col, sex_col, age_col]:
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")
    if include_region and region_col:
        merged[region_col] = pd.to_numeric(merged[region_col], errors="coerce")

    merged["weight"] = merged[weight_col].apply(lambda x: float(x) if pd.notna(x) else np.nan)
    merged["sex_key"] = merged[sex_col].apply(to_sex)
    merged["age_band"] = merged[age_col].apply(to_age_band)
    
    if include_region and region_col:
        merged["region_key"] = merged[region_col].apply(to_region_from_code)
    else:
        merged["region_key"] = "nationwide"
        include_region = False

    # Build cells dataframe for predictions
    cells_df = pd.DataFrame(acs_cells["cells"])[["cell_id", "sex", "age_band", "region", "pop"]].copy()
    cells_df = cells_df.rename(columns={"sex": "sex_key", "region": "region_key"})

    for trait in traits:
        print(f"\n{'='*60}")
        print(f"Modeling trait: {trait.label} ({trait.key})")
        print(f"{'='*60}")
        
        rule = trait.label_rule
        patterns = rule.get("column_patterns", [])
        threshold = rule.get("threshold_minutes", 1)
        
        # Sum time columns based on patterns
        minutes, matched_cols = sum_time_columns(merged, patterns, trait.key)
        merged[f"{trait.key}_minutes"] = minutes
        merged[trait.key] = (minutes >= threshold).astype(int)
        
        if not matched_cols:
            print(f"  WARNING: No columns matched for {trait.key}. Skipping.")
            continue
        
        # Filter to valid records
        keep_mask = (
            merged["weight"].notna()
            & (merged["weight"] > 0)
            & merged["sex_key"].notna()
            & merged["age_band"].notna()
        )
        if include_region:
            keep_mask &= merged["region_key"].notna()

        model_df = merged.loc[keep_mask, ["sex_key", "age_band", "region_key", "weight", trait.key]].copy()
        
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
            model_df = merged.loc[keep_mask, ["sex_key", "age_band", "region_key", "weight", trait.key]].copy()
        
        if model_df.empty:
            raise RuntimeError(f"No usable ATUS records for trait {trait.key} after filtering.")

        model_df[trait.key] = pd.to_numeric(model_df[trait.key], errors="coerce").astype(float)
        model_df["weight"] = pd.to_numeric(model_df["weight"], errors="coerce").astype(float)
        
        # Log summary before modeling
        log_trait_summary(trait.key, model_df, "weight")

        result, design_columns, feature_cols = fit_logit(
            model_df,
            trait.key,
            "weight",
            include_region=include_region,
        )
        print(result.summary())

        # Prepare cells for prediction
        adult_cells_df = cells_df[cells_df["age_band"] != "0_17"].copy()
        if not include_region:
            adult_cells_df["region_key"] = "nationwide"

        preds = predict_for_cells(result, design_columns, adult_cells_df[["sex_key", "age_band", "region_key"]])
        
        # Build prob_by_cell
        prob_by_cell = {cell_id: float(round(prob, 6)) for cell_id, prob in zip(adult_cells_df["cell_id"], preds)}
        
        # Add 0_17 cells with probability 0 (ineligible)
        child_cells = cells_df[cells_df["age_band"] == "0_17"]
        for _, row in child_cells.iterrows():
            prob_by_cell[row["cell_id"]] = 0.0
        
        # Validate
        prevalence = validate_probabilities(prob_by_cell, cells_df, trait.key, trait.prevalence_bounds)
        
        region_support = "national_only" if not include_region else "modeled"
        
        meta = {
            "source": trait.source,
            "year": 2024,
            "method": "weighted_logit",
            "features": feature_cols,
            "minAge": trait.minAge,
            "universeLabel": trait.universeLabel,
            "regionSupport": region_support,
            "generatedAt": pd.Timestamp.utcnow().isoformat(),
            "definition": trait.definition_notes,
            "columns_used": matched_cols[:10],  # Limit for readability
            "threshold_minutes": threshold,
            "implied_prevalence": round(prevalence, 4),
            "notes": "Region term excluded; national model." if not include_region else "Region-specific model.",
        }
        write_trait_output(trait.key, meta, prob_by_cell)

    print(f"\n{'='*60}")
    print("All ATUS traits built successfully!")
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Failed to build ATUS traits: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
