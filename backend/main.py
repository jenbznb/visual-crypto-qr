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

# --- 🌟 终极防崩溃：自适应 Hex/Base64 容错解码引擎 ---
def decode_payload_string(payload_str: str) -> str:
    """
    一键解决大小写转换、URL转义、缺失填充符、空格污染等所有扫码常见Bug
    """
    # 1. 基础清洗与解码转义
    clean_payload = urllib.parse.unquote(payload_str).strip()
    clean_payload = clean_payload.replace("[VC-S]", "").replace("[VC-STEGO]", "")
    
    # 2. 核心尝试 A：Hex 十六进制解码 (Case-insensitive，完全不受大小写转换影响)
    try:
        # 只保留 0-9, a-f, A-F 字符
        hex_chars = "".join([c for c in clean_payload if c in "0123456789abcdefABCDEF"])
        if len(hex_chars) > 0 and len(hex_chars) % 2 == 0:
            compressed_bytes = bytes.fromhex(hex_chars)
            return zlib.decompress(compressed_bytes).decode('utf-8')
    except Exception:
        pass  # 如果不是 Hex，则自动降级到 Base64 容错流程
        
    # 3. 核心尝试 B：Base64 兼容解码 (含空格纠正与自动补齐 "=" 填充)
    try:
        b64_cleaned = clean_payload.replace(" ", "+")
        padded_b64 = b64_cleaned + "=" * ((4 - len(b64_cleaned) % 4) % 4)
        compressed_bytes = base64.b64decode(padded_b64)
        return zlib.decompress(compressed_bytes).decode('utf-8')
    except Exception:
        # 如果 Zlib 解压彻底失败，退回直接展示原文本作为兜底
        return clean_payload


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
    """
    采用高压缩 Zlib + 终极大小写无关 Hex 编码
    """
    bait_url = "https://g.cn"
    compressed_bytes = zlib.compress(payload_str.encode('utf-8'), level=9)
    # 🌟 核心升级：改用 Hex 编码，彻底破坏由于 URL 大小写标准化造成的密文损毁
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


# ================= 🚀 业务接口 =================

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
    """
    直扫解析：支持从上传的图像帧进行形态学滤波，并一键完成 Hex/Base64 的自适应解析
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        detect = cv2.QRCodeDetector()
        val, _, _ = detect.detectAndDecode(img)
        
        if not val:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            val, _, _ = detect.detectAndDecode(thresh)

        if val:
            if "[VC-S]" in val:
                payload = val.split("[VC-S]")[1]
                return {"status": "success", "content": decode_payload_string(payload)}
            elif "[VC-STEGO]" in val:
                payload = val.split("[VC-STEGO]")[1]
                return {"status": "success", "content": decode_payload_string(payload)}
            else:
                return {"status": "success", "content": val}
        
        return {"status": "fail", "error": "未在二维码中检测到隐写协议头"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decode")
async def decode_vc_key(file: UploadFile = File(...)):
    """
    叠合解析：多尺度滤波 + 自适应 Hex 解码
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        detect = cv2.QRCodeDetector()
        
        for sc in [0.5, 1.0, 0.33]:
            dim = (int(img.shape[1]*sc), int(img.shape[0]*sc))
            resized = cv2.resize(img, dim, interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
            kernel = np.ones((3,3), np.uint8)
            clean = cv2.morphologyEx(cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)
            
            res, _, _ = detect.detectAndDecode(clean)
            if res:
                return {
                    "status": "success", 
                    "content": decode_payload_string(res), 
                    "cleanImage": img_to_base64(Image.fromarray(clean, mode='L'))
                }
        
        return {"status": "fail", "error": "叠合图像识别失败，请对齐或优化对比度。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decrypt_payload")
async def final_decrypt(
    request: Request,
    payload: Optional[str] = Form(None),
    key: Optional[str] = Form(None)
):
    """
    一键自适应解除数据包装并呈现明文
    """
    req_payload = payload
    if not req_payload:
        try:
            body = await request.json()
            req_payload = body.get("payload")
        except Exception:
            pass
            
    if not req_payload:
        return {"status": "fail", "error": "未接收到有效密文 payload 数据"}

    try:
        clean_plaintext = decode_payload_string(req_payload)
        return {"status": "success", "content": clean_plaintext}
    except Exception as e:
        return {"status": "fail", "error": f"解析失败：{str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)