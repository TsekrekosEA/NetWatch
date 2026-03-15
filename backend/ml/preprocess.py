"""
NetWatch Backend — CIC-IDS-2018 preprocessing module.

Handles loading, cleaning, and feature alignment for the CIC-IDS-2018 CSV
dataset. The public dataset uses different column names than our 20-feature
schema, so this module provides the mapping and data cleansing logic.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("netwatch.ml.preprocess")

# Mapping from CIC-IDS-2018 column names → our feature names.
# The CIC CSVs often have leading/trailing whitespace in column names.
CIC_COLUMN_MAP: dict[str, str] = {
    "Flow Duration": "duration",
    "Total Fwd Packets": "total_fwd_packets",
    "Tot Fwd Pkts": "total_fwd_packets",
    "Total Backward Packets": "total_bwd_packets",
    "Tot Bwd Pkts": "total_bwd_packets",
    "Total Length of Fwd Packets": "total_fwd_bytes",
    "TotLen Fwd Pkts": "total_fwd_bytes",
    "Total Length of Bwd Packets": "total_bwd_bytes",
    "TotLen Bwd Pkts": "total_bwd_bytes",
    "Fwd Packets/s": "fwd_packet_rate",
    "Fwd Pkts/s": "fwd_packet_rate",
    "Bwd Packets/s": "bwd_packet_rate",
    "Bwd Pkts/s": "bwd_packet_rate",
    "Fwd Header Length": "_fwd_header_len",
    "Fwd Header Len": "_fwd_header_len",
    "Flow Bytes/s": "_flow_bytes_per_s",
    "Flow Packets/s": "_flow_packets_per_s",
    "Flow IAT Mean": "mean_iat_fwd",
    "Flow IAT Std": "std_iat_fwd",
    "Fwd IAT Mean": "mean_iat_fwd",
    "Fwd IAT Std": "std_iat_fwd",
    "Bwd IAT Mean": "mean_iat_bwd",
    "Bwd IAT Std": "std_iat_bwd",
    "SYN Flag Count": "syn_flag_count",
    "SYN Flag Cnt": "syn_flag_count",
    "ACK Flag Count": "ack_flag_count",
    "ACK Flag Cnt": "ack_flag_count",
    "FIN Flag Count": "fin_flag_count",
    "FIN Flag Cnt": "fin_flag_count",
    "RST Flag Count": "rst_flag_count",
    "RST Flag Cnt": "rst_flag_count",
    "PSH Flag Count": "psh_flag_count",
    "PSH Flag Cnt": "psh_flag_count",
    "Average Packet Size": "mean_packet_length",
    "Pkt Size Avg": "mean_packet_length",
    "Packet Length Std": "std_packet_length",
    "Pkt Len Std": "std_packet_length",
    "Label": "label",
}

# Our canonical 20 features in order
FEATURE_COLUMNS = [
    "duration",
    "total_fwd_packets",
    "total_bwd_packets",
    "total_fwd_bytes",
    "total_bwd_bytes",
    "fwd_packet_rate",
    "bwd_packet_rate",
    "fwd_byte_rate",
    "bwd_byte_rate",
    "mean_iat_fwd",
    "std_iat_fwd",
    "mean_iat_bwd",
    "std_iat_bwd",
    "syn_flag_count",
    "ack_flag_count",
    "fin_flag_count",
    "rst_flag_count",
    "psh_flag_count",
    "mean_packet_length",
    "std_packet_length",
]


def load_cic_csvs(data_dir: str) -> pd.DataFrame:
    """
    Load all CIC-IDS-2018 CSV files from a directory and return a combined,
    cleaned DataFrame with our canonical feature columns plus a 'label' column.
    """
    data_path = Path(data_dir)
    csv_files = sorted(data_path.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError(
            f"No CSV files found in {data_dir}. "
            "Download CIC-IDS-2018 files — see data/README.md."
        )

    logger.info("Found %d CSV files in %s", len(csv_files), data_dir)

    frames: list[pd.DataFrame] = []
    for csv_file in csv_files:
        logger.info("Loading %s …", csv_file.name)
        df = pd.read_csv(csv_file, low_memory=False, encoding="utf-8")
        df = _align_columns(df)
        if df is not None:
            frames.append(df)

    if not frames:
        raise ValueError("No valid data loaded from CSV files.")

    combined = pd.concat(frames, ignore_index=True)
    logger.info("Combined dataset: %d rows", len(combined))

    combined = _clean_data(combined)
    combined = _derive_missing_features(combined)
    combined = _ensure_columns(combined)

    logger.info(
        "Final dataset: %d rows, %d features + label",
        len(combined),
        len(FEATURE_COLUMNS),
    )
    return combined


def _align_columns(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    """Strip whitespace from column names and apply the CIC→our name mapping."""
    df.columns = df.columns.str.strip()

    rename_map = {}
    for cic_name, our_name in CIC_COLUMN_MAP.items():
        if cic_name in df.columns:
            rename_map[cic_name] = our_name

    if not rename_map:
        logger.warning("No recognised CIC columns found — skipping file.")
        return None

    df = df.rename(columns=rename_map)
    return df


def _clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Replace infinities with column max, NaN with 0, negatives with abs."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    # Replace inf / -inf with NaN first, then fill
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan)

    # Fill NaN with column max (for former inf) then remaining NaN with 0
    for col in numeric_cols:
        col_max = df[col].max()
        if pd.isna(col_max):
            col_max = 0
        df[col] = df[col].fillna(col_max)

    # Negative values → absolute
    for col in numeric_cols:
        df[col] = df[col].abs()

    # Clean label column
    if "label" in df.columns:
        df["label"] = df["label"].astype(str).str.strip()

    logger.info("Data cleaned: %d rows", len(df))
    return df


def _derive_missing_features(df: pd.DataFrame) -> pd.DataFrame:
    """Derive features that may not exist directly in the CIC dataset."""
    # fwd_byte_rate and bwd_byte_rate from totals and duration
    if "fwd_byte_rate" not in df.columns:
        if "total_fwd_bytes" in df.columns and "duration" in df.columns:
            duration_safe = df["duration"].replace(0, 1e-6)
            df["fwd_byte_rate"] = df["total_fwd_bytes"] / duration_safe
        else:
            df["fwd_byte_rate"] = 0.0

    if "bwd_byte_rate" not in df.columns:
        if "total_bwd_bytes" in df.columns and "duration" in df.columns:
            duration_safe = df["duration"].replace(0, 1e-6)
            df["bwd_byte_rate"] = df["total_bwd_bytes"] / duration_safe
        else:
            df["bwd_byte_rate"] = 0.0

    # Use flow-level IAT for backward direction if not available
    if "mean_iat_bwd" not in df.columns:
        df["mean_iat_bwd"] = df.get("mean_iat_fwd", 0.0)
    if "std_iat_bwd" not in df.columns:
        df["std_iat_bwd"] = df.get("std_iat_fwd", 0.0)

    return df


def _ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Guarantee all 20 feature columns exist, filling missing ones with 0."""
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            logger.warning("Feature '%s' not found in data — filling with 0", col)
            df[col] = 0.0

    # Keep only our features + label
    keep = FEATURE_COLUMNS + (["label"] if "label" in df.columns else [])
    return df[keep].copy()
