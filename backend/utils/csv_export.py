"""
NetWatch Backend — CSV export utilities.
"""

import csv
import io

def generate_alerts_csv(alerts: list[dict]) -> str:
    """Generate a CSV string from a list of alert dictionaries."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "src_ip", "dst_ip", "src_port", "dst_port",
        "protocol", "category", "severity", "stage", "flow_duration",
        "total_bytes", "total_packets",
    ])
    for a in alerts:
        writer.writerow([
            a.get("id"), a.get("timestamp"), a.get("src_ip"), a.get("dst_ip"),
            a.get("src_port"), a.get("dst_port"), a.get("protocol"),
            a.get("category"), a.get("severity"), a.get("stage"),
            a.get("flow_duration"), a.get("total_bytes"), a.get("total_packets"),
        ])
    return buf.getvalue()
