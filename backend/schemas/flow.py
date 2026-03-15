"""
NetWatch Backend — Flow record Pydantic schema.

Defines the shape of the data sent by the capture service to the backend
ingest endpoint. All 20 flow features plus the 5-tuple metadata.
"""

from typing import Optional
from pydantic import BaseModel, Field


class FlowRecord(BaseModel):
    """A completed network flow with its extracted feature vector."""

    # ── 5-tuple metadata ──────────────────────────────────────────────
    src_ip: str
    dst_ip: str
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: str = "TCP"
    timestamp: float

    # ── 20-dimensional feature vector ─────────────────────────────────
    duration: float = Field(ge=0, description="Seconds from first to last packet")
    total_fwd_packets: int = Field(ge=0)
    total_bwd_packets: int = Field(ge=0)
    total_fwd_bytes: int = Field(ge=0)
    total_bwd_bytes: int = Field(ge=0)
    fwd_packet_rate: float = Field(ge=0)
    bwd_packet_rate: float = Field(ge=0)
    fwd_byte_rate: float = Field(ge=0)
    bwd_byte_rate: float = Field(ge=0)
    mean_iat_fwd: float = Field(ge=0)
    std_iat_fwd: float = Field(ge=0)
    mean_iat_bwd: float = Field(ge=0)
    std_iat_bwd: float = Field(ge=0)
    syn_flag_count: int = Field(ge=0)
    ack_flag_count: int = Field(ge=0)
    fin_flag_count: int = Field(ge=0)
    rst_flag_count: int = Field(ge=0)
    psh_flag_count: int = Field(ge=0)
    mean_packet_length: float = Field(ge=0)
    std_packet_length: float = Field(ge=0)

    def feature_vector(self) -> list[float]:
        """Return the 20 features as a flat list in canonical order."""
        return [
            self.duration,
            float(self.total_fwd_packets),
            float(self.total_bwd_packets),
            float(self.total_fwd_bytes),
            float(self.total_bwd_bytes),
            self.fwd_packet_rate,
            self.bwd_packet_rate,
            self.fwd_byte_rate,
            self.bwd_byte_rate,
            self.mean_iat_fwd,
            self.std_iat_fwd,
            self.mean_iat_bwd,
            self.std_iat_bwd,
            float(self.syn_flag_count),
            float(self.ack_flag_count),
            float(self.fin_flag_count),
            float(self.rst_flag_count),
            float(self.psh_flag_count),
            self.mean_packet_length,
            self.std_packet_length,
        ]
