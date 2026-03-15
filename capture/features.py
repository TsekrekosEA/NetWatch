"""
NetWatch Capture Service — Feature extraction.

Computes the 20-dimensional feature vector from a flow's accumulated
packet-level statistics. Each feature is designed to capture a different
aspect of network behaviour and together they span the same feature
space used by the CIC-IDS-2018 benchmark dataset.
"""

import numpy as np


def extract_features(flow) -> list[float]:
    """
    Compute the 20-dimensional feature vector from a FlowState object.

    Feature order:
      0  duration              5  fwd_packet_rate     10 std_iat_fwd      15 fin_flag_count
      1  total_fwd_packets     6  bwd_packet_rate     11 mean_iat_bwd     16 rst_flag_count
      2  total_bwd_packets     7  fwd_byte_rate       12 std_iat_bwd      17 psh_flag_count
      3  total_fwd_bytes       8  bwd_byte_rate       13 syn_flag_count   18 mean_packet_length
      4  total_bwd_bytes       9  mean_iat_fwd        14 ack_flag_count   19 std_packet_length
    """
    duration = max(flow.last_ts - flow.first_ts, 0.0)
    duration_safe = duration if duration > 1e-6 else 1e-6

    # Packet and byte rates
    fwd_packet_rate = flow.fwd_packets / duration_safe
    bwd_packet_rate = flow.bwd_packets / duration_safe
    fwd_byte_rate = flow.fwd_bytes / duration_safe
    bwd_byte_rate = flow.bwd_bytes / duration_safe

    # Inter-arrival times
    mean_iat_fwd = float(np.mean(flow.fwd_iats)) if flow.fwd_iats else 0.0
    std_iat_fwd = float(np.std(flow.fwd_iats)) if flow.fwd_iats else 0.0
    mean_iat_bwd = float(np.mean(flow.bwd_iats)) if flow.bwd_iats else 0.0
    std_iat_bwd = float(np.std(flow.bwd_iats)) if flow.bwd_iats else 0.0

    # Packet length statistics
    if flow.packet_lengths:
        mean_pkt_len = float(np.mean(flow.packet_lengths))
        std_pkt_len = float(np.std(flow.packet_lengths))
    else:
        mean_pkt_len = 0.0
        std_pkt_len = 0.0

    return [
        duration,
        float(flow.fwd_packets),
        float(flow.bwd_packets),
        float(flow.fwd_bytes),
        float(flow.bwd_bytes),
        fwd_packet_rate,
        bwd_packet_rate,
        fwd_byte_rate,
        bwd_byte_rate,
        mean_iat_fwd,
        std_iat_fwd,
        mean_iat_bwd,
        std_iat_bwd,
        float(flow.syn_count),
        float(flow.ack_count),
        float(flow.fin_count),
        float(flow.rst_count),
        float(flow.psh_count),
        mean_pkt_len,
        std_pkt_len,
    ]
