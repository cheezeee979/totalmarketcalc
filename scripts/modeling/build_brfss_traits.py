"""
Build modeled trait probabilities from BRFSS 2024 microdata.

Steps:
- Load the ACS cell backbone (data/derived/acs_cells.json).
- Detect the latest BRFSS XPT file under data/raw/brfss/2024/.
- Normalize sex, age_band, and region (from state FIPS → Census region).
- Fit weighted logistic regressions for each configured trait.
- Predict probabilities for every ACS cell and write JSON artifacts to data/derived/traits/.
- Validate implied prevalence is within plausible bounds.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
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
    state_vars: List[str]
    minAge: int = 18
    universeLabel: str = "Adults 18+"
    regionSupport: str = "modeled"
    prevalence_bounds: List[float] = field(default_factory=lambda: [0.01, 0.50])


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
    """
    Derive current smoker status using _SMOKER3 (preferred) or fallback variables.
    
    _SMOKER3 (Computed Smoking Status):
        1 = Current smoker - now smokes every day → SMOKER (1)
        2 = Current smoker - now smokes some days → SMOKER (1)
        3 = Former smoker → NON-SMOKER (0)
        4 = Never smoked → NON-SMOKER (0)
        9 = Don't know/Refused/Missing → EXCLUDE (None)
    
    _RFSMOK3 (Risk factor for smoking - AVOID, coding is confusing):
        1 = No (not current smoker) → NON-SMOKER (0)
        2 = Yes (current smoker) → SMOKER (1)
        9 = Don't know/Refused/Missing → EXCLUDE (None)
    """
    # Try _SMOKER3 first (clearer coding)
    smoker3_col = columns.get("_SMOKER3")
    if smoker3_col:
        val = row[smoker3_col]
        if pd.notna(val):
            code = int(val)
            if code in (1, 2):  # Current smoker (every day or some days)
                return 1
            if code == 4:  # Never smoked
                return 0
            if code == 3:  # Former smoker - treat as non-current-smoker
                return 0
            # code 9 or other = missing/refused, exclude
            return None

    # Try _RFSMOK3 with CORRECT interpretation
    rfsmok3_col = columns.get("_RFSMOK3")
    if rfsmok3_col:
        val = row[rfsmok3_col]
        if pd.notna(val):
            code = int(val)
            if code == 2:  # Yes = current smoker
                return 1
            if code == 1:  # No = not current smoker
                return 0
            # code 9 = missing/refused, exclude
            return None

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
        # SMOKE100=1 means smoked at least 100 cigarettes in lifetime
        # SMOKDAY2: 1=every day, 2=some days, 3=not at all
        if smoke100 == 1 and smokday2 in (1, 2):  # Current smoker
            return 1
        if smoke100 == 2:  # Never smoked 100 cigarettes
            return 0
        if smoke100 == 1 and smokday2 == 3:  # Former smoker (smoked 100+ but not now)
            return 0
    return None


def derive_activity(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    """
    Derive physical activity status using _TOTINDA.
    
    _TOTINDA (Adults who reported doing physical activity in past 30 days):
        1 = Had physical activity
        2 = No physical activity
        9 = Don't know/Refused/Missing
    """
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
        # 9 = missing/refused
    return None


def derive_alcohol(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    """
    Derive any alcohol use in past 30 days.
    
    DRNKANY6 (Had at least one drink in past 30 days):
        1 = Yes
        2 = No
        7 = Don't know
        9 = Refused/Missing
    
    _DRNKWK3 (Computed total drinks per week):
        Positive value = drank
        0 or 88888 = No drinks
        99999 = Missing
    
    ALCDAY4 (Days per week/month had drink - fallback):
        1XX = Days per week (101-107)
        2XX = Days per month (201-230)
        888 = No drinks in past 30 days
        777/999 = Don't know/Refused
    """
    # Try DRNKANY6 first (BRFSS 2024 variable)
    drnkany_col = columns.get("DRNKANY6")
    if drnkany_col:
        val = row[drnkany_col]
        if pd.notna(val):
            code = int(val)
            if code == 1:  # Yes, had a drink
                return 1
            if code == 2:  # No drinks
                return 0
            # 7/9 = don't know/refused
            return None
    
    # Try _DRNKWK3 (computed drinks per week)
    drnkwk_col = columns.get("_DRNKWK3")
    if drnkwk_col:
        val = row[drnkwk_col]
        if pd.notna(val):
            code = float(val)
            if code == 99999:  # Missing
                return None
            if code > 0 and code < 88888:  # Positive drinks
                return 1
            return 0  # Zero drinks
    
    # Try ALCDAY4 fallback
    alcday_col = columns.get("ALCDAY4")
    if alcday_col:
        val = row[alcday_col]
        if pd.notna(val):
            code = int(val)
            if code == 888:  # No drinks in past 30 days
                return 0
            if 101 <= code <= 199 or 201 <= code <= 299:  # Had drinks
                return 1
            if code in (777, 999):  # Don't know / refused
                return None
    return None


def derive_obese(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    """
    Derive obesity status (BMI >= 30).
    
    _BMI5CAT (BMI Category):
        1 = Underweight
        2 = Normal Weight
        3 = Overweight
        4 = Obese
        . = Missing
    
    _BMI5 (BMI * 100 - calculated from height/weight):
        e.g., 2500 = BMI of 25.00
        >= 3000 = Obese
    """
    # Try _BMI5CAT first (cleaner)
    bmi5cat_col = columns.get("_BMI5CAT")
    if bmi5cat_col:
        val = row[bmi5cat_col]
        if pd.notna(val):
            code = int(val)
            if code == 4:  # Obese
                return 1
            if code in (1, 2, 3):  # Underweight, Normal, Overweight
                return 0
            return None
    
    # Try _BMI5 (continuous value * 100)
    bmi5_col = columns.get("_BMI5")
    if bmi5_col:
        val = row[bmi5_col]
        if pd.notna(val):
            bmi_x100 = float(val)
            if bmi_x100 < 1000 or bmi_x100 > 9900:  # Invalid/missing
                return None
            bmi = bmi_x100 / 100.0
            if bmi >= 30.0:
                return 1
            return 0
    return None


def derive_chronic_condition(row: pd.Series, rule: dict, columns: Dict[str, str]) -> Optional[int]:
    """
    Derive whether respondent has any chronic condition.
    
    Condition variables typically use:
        1 = Yes
        2 = No
        7/9 = Don't know/Refused/Missing
    
    We check for: diabetes, asthma, COPD, heart disease, stroke, kidney disease, cancer, arthritis
    """
    condition_vars = rule.get("condition_vars", [
        "DIABETE4", "ASTHMA3", "CHCCOPD3", "CVDCRHD4", 
        "CVDSTRK3", "CHCKDNY2", "CHCOCNCR", "HAVARTH5"
    ])
    
    has_any = None
    all_missing = True
    
    for var in condition_vars:
        col = columns.get(var.upper())
        if not col:
            continue
        val = row[col]
        if pd.isna(val):
            continue
        code = int(val)
        if code == 1:  # Yes, has this condition
            return 1  # Short-circuit: any = yes
        if code == 2:  # No
            all_missing = False
            if has_any is None:
                has_any = 0
        # 7/9 = missing for this variable
    
    if all_missing:
        return None  # All condition fields missing
    
    return has_any  # 0 if at least one "No" found and no "Yes"


DERIVE_FUNCTIONS = {
    "smokes": derive_smoking,
    "physically_active": derive_activity,
    "any_alcohol_use": derive_alcohol,
    "obese": derive_obese,
    "any_chronic_condition": derive_chronic_condition,
}


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


def validate_probabilities(
    prob_by_cell: Dict[str, float], 
    cells_df: pd.DataFrame, 
    trait_key: str,
    bounds: List[float]
) -> float:
    """
    Validate probabilities are finite and within [0,1].
    Compute and validate implied national prevalence.
    Returns the computed prevalence.
    """
    min_prev, max_prev = bounds
    
    # Check all probabilities are valid
    for cell_id, prob in prob_by_cell.items():
        if not np.isfinite(prob):
            raise ValueError(f"Trait {trait_key}: probability for {cell_id} is not finite: {prob}")
        if prob < 0 or prob > 1:
            raise ValueError(f"Trait {trait_key}: probability for {cell_id} out of bounds [0,1]: {prob}")
    
    # Compute implied national prevalence: Σ(pop × prob) / Σ(pop)
    # Only use adult cells (age_band != 0_17) for BRFSS traits
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
            f"This likely indicates label inversion or incorrect missing value handling. "
            f"Check the derive function logic."
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
    print(f"    Valid rows (non-missing label): {valid_rows:,}")
    print(f"    Total weight: {total_weight:,.0f}")
    print(f"    Weighted prevalence (survey): {weighted_prevalence:.2%}")
    print(f"    Positive cases: {(labels == 1).sum():,} ({(labels == 1).mean():.1%} unweighted)")
    print(f"    Negative cases: {(labels == 0).sum():,} ({(labels == 0).mean():.1%} unweighted)")


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
    
    # Log available columns for debugging
    print(f"Total columns in BRFSS: {len(df.columns)}")
    
    # Identify relevant columns for debugging
    relevant_prefixes = ['SMOKE', '_SMOKE', '_RFSMOK', 'ALCDAY', '_DRNK', '_BMI', 'DIABETE', 
                         'ASTHMA', 'CHCCOPD', 'CVDCRHD', 'CVDSTRK', 'CHCKDNY', 'CHCOCNCR', 
                         'HAVARTH', '_TOTIND', '_LLCPWT', 'SEXVAR', '_AGEG5YR', '_STATE']
    found_cols = [c for c in columns.keys() if any(c.startswith(p) for p in relevant_prefixes)]
    print(f"Relevant columns found: {found_cols[:30]}...")

    weight_col = select_column(columns, traits[0].weight_vars, "weight")
    sex_col = select_column(columns, traits[0].sex_vars, "sex")
    age_col = select_column(columns, traits[0].age_vars, "age")
    state_col = select_column(columns, traits[0].state_vars, "state")
    
    print(f"Using weight column: {weight_col}")

    # Gather all needed columns
    base_cols = {weight_col, sex_col, age_col, state_col}
    needed_trait_vars = set()
    
    # Always include these smoking columns for fallback
    needed_trait_vars.update(["_SMOKER3", "_RFSMOK3", "SMOKE100", "SMOKDAY2"])
    
    for trait in traits:
        needed_trait_vars.update(trait.label_rule.get("preferred_vars", []))
        needed_trait_vars.update(trait.label_rule.get("fallback", []))
        needed_trait_vars.update(trait.label_rule.get("condition_vars", []))

    selected_cols = [columns[c.upper()] for c in needed_trait_vars if c.upper() in columns] + list(base_cols)
    df = df[list(set(selected_cols))].copy()

    # Coerce numeric codes before recoding
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["weight"] = df[weight_col].apply(lambda x: float(x) if pd.notna(x) else np.nan)
    df["sex_key"] = df[sex_col].apply(to_sex)
    df["age_band"] = df[age_col].apply(to_age_band)
    df["region_key"] = df[state_col].apply(lambda x: state_regions.get(str(int(x)).zfill(2)) if pd.notna(x) else None)
    
    # Filter to valid weights
    initial_rows = len(df)
    df = df[df["weight"].notna() & (df["weight"] > 0)]
    print(f"Rows with valid weights: {len(df):,} / {initial_rows:,}")

    # Build cells dataframe for predictions
    cells_df = pd.DataFrame(acs_cells["cells"])
    cells_df = cells_df.rename(columns={"sex": "sex_key", "region": "region_key"})

    for trait in traits:
        print(f"\n{'='*60}")
        print(f"Modeling trait: {trait.label} ({trait.key})")
        print(f"{'='*60}")
        
        derive_fn = DERIVE_FUNCTIONS.get(trait.key)
        if derive_fn is None:
            print(f"WARNING: No derive function for trait {trait.key}, skipping.")
            continue
        
        df[trait.key] = df.apply(lambda row: derive_fn(row, trait.label_rule, columns), axis=1)

        # Count excluded rows (missing labels)
        total_with_weight = len(df)
        missing_label = df[trait.key].isna().sum()
        print(f"  Excluded rows (missing/refused): {missing_label:,} ({missing_label/total_with_weight:.1%})")

        trait_df = df.dropna(subset=[trait.key, "sex_key", "age_band", "region_key"]).copy()
        trait_df[trait.key] = pd.to_numeric(trait_df[trait.key], errors="coerce")
        trait_df["weight"] = pd.to_numeric(trait_df["weight"], errors="coerce")
        if trait_df.empty:
            raise RuntimeError(f"No usable records for trait {trait.key}")

        # Log summary before modeling
        log_trait_summary(trait.key, trait_df, "weight")

        model_df = trait_df[["sex_key", "age_band", "region_key", "weight", trait.key]].copy()
        result, design_columns = fit_logit(model_df, trait.key, "weight")
        print(result.summary())

        # Only predict for adult cells (BRFSS is 18+)
        adult_cells_df = cells_df[cells_df["age_band"] != "0_17"].copy()
        
        preds = predict_for_cells(result, design_columns, adult_cells_df[["sex_key", "age_band", "region_key"]])

        # Create prob_by_cell with adult cells having model predictions
        prob_by_cell = {cell_id: float(round(prob, 6)) for cell_id, prob in zip(adult_cells_df["cell_id"], preds)}
        
        # Add 0_17 cells with probability 0 (ineligible)
        child_cells = cells_df[cells_df["age_band"] == "0_17"]
        for _, row in child_cells.iterrows():
            prob_by_cell[row["cell_id"]] = 0.0
        
        # Validate probabilities and prevalence
        prevalence = validate_probabilities(prob_by_cell, cells_df, trait.key, trait.prevalence_bounds)
        
        meta = {
            "source": trait.source,
            "year": 2024,
            "method": "weighted_logit",
            "features": ["sex", "age_band", "region"],
            "minAge": trait.minAge,
            "universeLabel": trait.universeLabel,
            "regionSupport": trait.regionSupport,
            "generatedAt": pd.Timestamp.utcnow().isoformat(),
            "definition": trait.definition_notes,
            "implied_prevalence": round(prevalence, 4),
        }
        write_trait_output(trait.key, meta, prob_by_cell)

    print(f"\n{'='*60}")
    print("All BRFSS traits built successfully!")
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"\nFailed to build BRFSS traits: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
