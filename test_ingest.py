import httpx
import time

payload = {
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

resp = httpx.post(
    "http://localhost:8001/ingest",
    json=payload,
    headers={"X-Capture-Token": "change-me-in-production"}
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")
