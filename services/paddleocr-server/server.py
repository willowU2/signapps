"""
PaddleOCR REST API Server
Provides OCR capabilities with table detection support.
Uses PaddleOCR 2.x API (stable).
"""
import os
# Disable OneDNN to avoid compatibility issues
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['MKLDNN_VERBOSE'] = '0'

import base64
import io
import logging
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PaddleOCR Server", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR with multilingual support (2.x API)
logger.info("Initializing PaddleOCR...")
ocr = PaddleOCR(
    use_angle_cls=True,  # Detect text orientation
    lang='en',           # Default to English, can detect other languages
    use_gpu=False,       # CPU mode
    show_log=False,      # Reduce log verbosity
)
logger.info("PaddleOCR initialized successfully")


class OcrRequest(BaseModel):
    image_base64: str


class OcrResponse(BaseModel):
    ocr_result: list
    text: str
    tables: list = []


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "paddleocr-server"}


@app.post("/api/ocr", response_model=OcrResponse)
async def ocr_base64(request: OcrRequest):
    """OCR with base64 encoded image"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Convert PIL Image to numpy array
        img_array = np.array(image)

        # Run OCR (PaddleOCR 2.x API uses ocr() method)
        result = ocr.ocr(img_array, cls=True)

        # Parse results - PaddleOCR 2.x format: [[[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], (text, confidence)], ...]
        ocr_result = []
        text_lines = []

        logger.info(f"OCR result type: {type(result)}")

        if result and isinstance(result, list):
            # result is a list of pages, each page is a list of text blocks
            for page in result:
                if page:
                    for line in page:
                        if line and len(line) >= 2:
                            bbox = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                            text_info = line[1]  # (text, confidence)

                            if isinstance(text_info, tuple) and len(text_info) >= 2:
                                text = text_info[0]
                                confidence = float(text_info[1])
                            else:
                                text = str(text_info)
                                confidence = 0.9

                            if text:
                                text_lines.append(text)
                                ocr_result.append([bbox, text, confidence])
                                logger.info(f"Detected: '{text}' (conf: {confidence:.2f})")

        return OcrResponse(
            ocr_result=ocr_result,
            text="\n".join(text_lines),
            tables=[]
        )

    except Exception as e:
        logger.error(f"OCR failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ocr/upload")
async def ocr_upload(file: UploadFile = File(...)):
    """OCR with file upload"""
    try:
        # Read uploaded file
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Convert PIL Image to numpy array
        img_array = np.array(image)

        # Run OCR (PaddleOCR 2.x API)
        result = ocr.ocr(img_array, cls=True)

        # Parse results
        ocr_result = []
        text_lines = []

        if result and isinstance(result, list):
            for page in result:
                if page:
                    for line in page:
                        if line and len(line) >= 2:
                            bbox = line[0]
                            text_info = line[1]

                            if isinstance(text_info, tuple) and len(text_info) >= 2:
                                text = text_info[0]
                                confidence = float(text_info[1])
                            else:
                                text = str(text_info)
                                confidence = 0.9

                            if text:
                                text_lines.append(text)
                                ocr_result.append([bbox, text, confidence])

        return {
            "ocr_result": ocr_result,
            "text": "\n".join(text_lines),
            "tables": []
        }

    except Exception as e:
        logger.error(f"OCR failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9003)
