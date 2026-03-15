# CIC-IDS-2018 Dataset

## Overview

The CIC-IDS-2018 dataset (Canadian Institute for Cybersecurity) is the standard academic
benchmark for intrusion detection research. It contains approximately 16 million labelled
network flows across 14 attack categories.

## Download Instructions

1. Visit the official dataset page:
   https://www.unb.ca/cic/datasets/ids-2018.html

2. The dataset is hosted on AWS. Download the **Processed Traffic Data for ML Algorithms**
   CSV files. The relevant files are:

   - `Friday-02-03-2018_TrafficForML_CICFlowMeter.csv`
   - `Friday-16-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Friday-23-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Thursday-01-03-2018_TrafficForML_CICFlowMeter.csv`
   - `Thursday-15-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Thursday-22-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Tuesday-20-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Wednesday-14-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Wednesday-21-02-2018_TrafficForML_CICFlowMeter.csv`
   - `Wednesday-28-02-2018_TrafficForML_CICFlowMeter.csv`

3. Place all downloaded CSV files in this `data/` directory.

4. Run the training pipeline:

   ```bash
   cd backend
   python -m ml.train
   ```

5. Evaluate the trained models:

   ```bash
   python -m ml.evaluate
   ```

## Attack Categories in the Dataset

| Category               | Description                                  |
|------------------------|----------------------------------------------|
| Benign                 | Normal network traffic                        |
| DoS attacks-Hulk       | HTTP flood denial of service                  |
| DoS attacks-SlowHTTPTest | Slow HTTP denial of service                |
| DoS attacks-Slowloris  | Slow connection denial of service             |
| DoS attacks-GoldenEye  | HTTP flood variant                            |
| DDoS attacks-LOIC-HTTP | Distributed HTTP flood                       |
| DDoS attacks-LOIC-UDP  | Distributed UDP flood                        |
| FTP-BruteForce         | Brute force login to FTP servers             |
| SSH-Bruteforce         | Brute force login to SSH servers             |
| Brute Force -Web       | Web application brute force                  |
| Brute Force -XSS       | Cross-site scripting attempts                |
| SQL Injection          | SQL injection attempts                       |
| Infilteration          | Network infiltration attempt                 |
| Bot                    | Botnet command and control traffic            |

## Storage Requirements

The full dataset is approximately 8 GB in CSV format. Ensure sufficient disk space before
downloading.

## Notes

- CSV column names may have leading/trailing whitespace — the preprocessing script handles
  this automatically.
- Some rows contain `inf` or `NaN` values — the preprocessing script cleans these.
- The `Label` column has a leading space in some CSV files (` Label`) — handled by the
  preprocessing script.
