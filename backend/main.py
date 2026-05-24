import io
import base64
import numpy as np
import qrcode
import cv2
from fastapi import FastAPI, Form, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import json
import zlib  
import urllib.parse
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vc.115333.xyz",
        "https://www.vc.115333.xyz",
        "https://hunyuan.ggff.net",
        "https://www.hunyuan.ggff.net",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 工具函数：图片转换 ---
def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

# --- 终极防崩溃：自适应 Hex/Base64 容错解码引擎 ---
def decode_payload_string(payload_str: str) -> str:
    """
    一键自适应清洗：完美剥离诱导前缀，确保精准命中 Hex 密文流进行 Zlib 还原
    """
    clean_payload = urllib.parse.unquote(payload_str).strip()
    
    if "#[VC-S]" in clean_payload:
        clean_payload = clean_payload.split("#[VC-S]")[1]
    elif "#" in clean_payload:
        clean_payload = clean_payload.split("#")[1]
    
    clean_payload = clean_payload.replace("[VC-S]", "").replace("[VC-STEGO]", "")
    
    # 核心尝试 A：Hex 十六进制快速解压 (Case-insensitive)
    try:
        hex_chars = "".join([c for c in clean_payload if c in "0123456789abcdefABCDEF"])
        if len(hex_chars) > 0 and len(hex_chars) % 2 == 0:
            compressed_bytes = bytes.fromhex(hex_chars)
            return zlib.decompress(compressed_bytes).decode('utf-8')
    except Exception:
        pass  
        
    # 核心尝试 B：Base64 兼容解压
    try:
        b64_cleaned = clean_payload.replace(" ", "+")
        padded_b64 = b64_cleaned + "=" * ((4 - len(b64_cleaned) % 4) % 4)
        compressed_bytes = base64.b64decode(padded_b64)
        return zlib.decompress(compressed_bytes).decode('utf-8')
    except Exception:
        return clean_payload

# --- 核心图像清洗引擎（跨模块公用） ---
def process_opencv_purify(img_bytes: bytes):
    """
    封装统一的 OpenCV 空间域低通积分与形态学清洗流
    """
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 多尺度低通面积加权积分循环
    for sc in [0.5, 1.0, 0.33]:
        dim = (int(img.shape[1] * sc), int(img.shape[0] * sc))
        resized = cv2.resize(img, dim, interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
        kernel = np.ones((3, 3), np.uint8)
        clean_mat = cv2.morphologyEx(cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)
        
        detect = cv2.QRCodeDetector()
        res, _, _ = detect.detectAndDecode(clean_mat)
        if res:
            return clean_mat, res
            
    # 若多尺度都未在当前帧捕捉到有效条码，则提供默认比例的清洗底图作为可视化微调反馈
    dim = (int(img.shape[1] * 0.5), int(img.shape[0] * 0.5))
    resized = cv2.resize(img, dim, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
    kernel = np.ones((3, 3), np.uint8)
    clean_mat = cv2.morphologyEx(cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)
    return clean_mat, None

# --- 视觉密码核心 (VC) ---
def add_alignment_marks(img_array):
    h, w = img_array.shape
    mark_size = 20
    thickness = 4
    corners = [(0, 0), (0, w - mark_size), (h - mark_size, 0), (h - mark_size, w - mark_size)]
    for y_start, x_start in corners:
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, x_start : x_start + mark_size] = 0
        img_array[y_start : y_start + mark_size, x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

def apply_visual_crypto(source_arr):
    h, w = source_arr.shape
    patterns = np.array([
        [[0, 1], [0, 1]], 
        [[1, 0], [1, 0]], 
        [[0, 0], [1, 1]], 
        [[1, 1], [0, 0]], 
        [[0, 1], [1, 0]], 
        [[1, 0], [0, 1]]
    ], dtype=np.uint8)
    
    rng = np.random.randint(0, 6, size=(h, w))
    pat_a = patterns[rng]
    mask = source_arr[:, :, np.newaxis, np.newaxis]
    pat_b = np.where(mask, pat_a, 1 - pat_a)
    
    final_h, final_w = h * 2, w * 2
    share_a_img = pat_a.swapaxes(1, 2).reshape(final_h, final_w) * 255
    share_b_img = pat_b.swapaxes(1, 2).reshape(final_h, final_w) * 255
    
    padding = 20
    full_a = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
    full_b = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
    full_a[padding:-padding, padding:-padding] = share_a_img
    full_b[padding:-padding, padding:-padding] = share_b_img
    
    stacked = np.minimum(full_a, full_b)
    dim = (int(stacked.shape[1] * 0.5), int(stacked.shape[0] * 0.5))
    resized = cv2.resize(stacked, dim, interpolation=cv2.INTER_AREA)
    _, thresh = cv2.threshold(resized, 100, 255, cv2.THRESH_BINARY)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
    
    return Image.fromarray(add_alignment_marks(full_a), mode='L'), \
           Image.fromarray(add_alignment_marks(full_b), mode='L'), \
           img_to_base64(Image.fromarray(opening, mode='L'))

def generate_stego_qr_matrix_and_base64(payload_str: str):
    bait_url = "https://g.cn"
    compressed_bytes = zlib.compress(payload_str.encode('utf-8'), level=9)
    compressed_hex = compressed_bytes.hex()
    stego_content = f"{bait_url}#[VC-S]{compressed_hex}"
    
    qr = qrcode.QRCode(
        version=None, 
        error_correction=qrcode.constants.ERROR_CORRECT_H, 
        box_size=10, 
        border=4
    )
    qr.add_data(stego_content)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('1')
    source_arr = np.array(qr_img, dtype=bool)
    
    buffered = io.BytesIO()
    qr_img.save(buffered, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
    
    return source_arr, qr_b64


# ================= 🚀 业务解密接口 =================

@app.post("/generate")
async def generate(text: str = Form(...)):
    try:
        source_arr, stego_qr_b64 = generate_stego_qr_matrix_and_base64(text)
        img1, img2, preview_clean = apply_visual_crypto(source_arr)
        return {
            "status": "success", 
            "ciphertext_qr": stego_qr_b64, 
            "share1": img_to_base64(img1), 
            "share2": img_to_base64(img2), 
            "previewClean": preview_clean
        }
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decode_normal_qr")
async def extract_stego_data(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        clean_mat, decoded_text = process_opencv_purify(contents)
        if decoded_text:
            return {"status": "success", "content": decode_payload_string(decoded_text)}
        return {"status": "fail", "error": "未在图像帧中检索到可识别矩阵"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

# ⚡ 阶段一：纯重建层接口 (常驻按钮调用)
@app.post("/purify_only")
async def purify_only_interface(file: UploadFile = File(...)):
    """
    只滤波重建，绝不执行数据解压及明文流转换。专门为对齐微调提供可视化回显。
    """
    try:
        contents = await file.read()
        clean_mat, _ = process_opencv_purify(contents)
        return {
            "status": "success", 
            "cleanImage": img_to_base64(Image.fromarray(clean_mat, mode='L'))
        }
    except Exception as e:
        return {"status": "fail", "error": str(e)}

# 🔍 阶段二：业务解密层接口 (云端识别调用)
@app.post("/decode")
async def decode_vc_key(file: UploadFile = File(...)):
    """
    执行高深度数据链路拆包，最终在气泡弹窗内释放明文。
    """
    try:
        contents = await file.read()
        clean_mat, decoded_text = process_opencv_purify(contents)
        if decoded_text:
            return {
                "status": "success", 
                "content": decode_payload_string(decoded_text), 
                "cleanImage": img_to_base64(Image.fromarray(clean_mat, mode='L'))
            }
        return {"status": "fail", "error": "物理对准仍有细微偏置，或对比度不达标，请根据净化预览图微调。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decrypt_payload")
async def final_decrypt(request: Request, payload: Optional[str] = Form(None)):
    req_payload = payload
    if not req_payload:
        try:
            body = await request.json()
            req_payload = body.get("payload")
        except Exception:
            pass
            
    if not req_payload:
        return {"status": "fail", "error": "未接收到有效密文数据"}

    try:
        clean_plaintext = decode_payload_string(req_payload)
        return {"status": "success", "content": clean_plaintext}
    except Exception as e:
        return {"status": "fail", "error": f"解析失败：{str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)