FROM python:3.10-slim-bookworm

# Disable OneDNN/MKL-DNN to avoid compatibility issues
ENV FLAGS_use_mkldnn=0
ENV MKLDNN_VERBOSE=0

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies - using stable PaddleOCR 2.x
RUN pip install --no-cache-dir \
    numpy \
    "paddlepaddle==2.6.2" \
    "paddleocr==2.8.1" \
    fastapi \
    uvicorn \
    python-multipart \
    pillow

COPY server.py .

EXPOSE 9003

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "9003"]
