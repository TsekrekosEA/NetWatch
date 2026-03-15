"""
Shared pytest fixtures for the NetWatch test suite.
"""

import os
import sys
import time

import pytest
import pytest_asyncio

# Ensure backend package root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Override settings before any backend module imports them
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_netwatch.db")


@pytest_asyncio.fixture()
async def test_db(tmp_path):
    """Create a test database with schema applied."""
    import database

    original_path = database.DB_PATH
    db_path = str(tmp_path / "test.db")
    database.DB_PATH = db_path

    await database.init_db()
    yield db_path

    database.DB_PATH = original_path


@pytest.fixture()
def sample_flow_dict():
    """A minimal valid flow record payload."""
    return {
        "src_ip": "10.0.0.1",
        "dst_ip": "192.168.1.1",
        "src_port": 12345,
        "dst_port": 80,
        "protocol": "TCP",
        "timestamp": time.time(),
        "duration": 1.5,
        "total_fwd_packets": 10,
        "total_bwd_packets": 8,
        "total_fwd_bytes": 5000,
        "total_bwd_bytes": 3000,
        "fwd_packet_rate": 6.67,
        "bwd_packet_rate": 5.33,
        "fwd_byte_rate": 3333.0,
        "bwd_byte_rate": 2000.0,
        "mean_iat_fwd": 0.15,
        "std_iat_fwd": 0.05,
        "mean_iat_bwd": 0.18,
        "std_iat_bwd": 0.06,
        "syn_flag_count": 1,
        "ack_flag_count": 10,
        "fin_flag_count": 1,
        "rst_flag_count": 0,
        "psh_flag_count": 5,
        "mean_packet_length": 444.0,
        "std_packet_length": 200.0,
    }


@pytest.fixture()
def sample_features():
    """A 20-element feature vector matching FEATURE_NAMES order."""
    return [
        1.5,      # duration
        10.0,     # total_fwd_packets
        8.0,      # total_bwd_packets
        5000.0,   # total_fwd_bytes
        3000.0,   # total_bwd_bytes
        6.67,     # fwd_packet_rate
        5.33,     # bwd_packet_rate
        3333.0,   # fwd_byte_rate
        2000.0,   # bwd_byte_rate
        0.15,     # mean_iat_fwd
        0.05,     # std_iat_fwd
        0.18,     # mean_iat_bwd
        0.06,     # std_iat_bwd
        1.0,      # syn_flag_count
        10.0,     # ack_flag_count
        1.0,      # fin_flag_count
        0.0,      # rst_flag_count
        5.0,      # psh_flag_count
        444.0,    # mean_packet_length
        200.0,    # std_packet_length
    ]
