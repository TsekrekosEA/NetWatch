FROM python:3.11.14-slim

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libpcap0.8 \
    tcpdump \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
