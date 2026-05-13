import io
import base64
import numpy as np
import qrcode
import cv2
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import json
from Crypto.Cipher import AES
import secrets
import segno
import zlib  # 🌟 新增：引入底层极限压缩引擎

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
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 工具函数：图片处理 ---
def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

# --- AES-GCM 加密管道 (含 Zlib 极限压缩) ---
def encrypt_aes_gcm(plaintext: str, key_hex: str) -> str:
    key = key_hex.encode('utf-8')
    cipher = AES.new(key, AES.MODE_GCM)
    
    # 🌟 核心瘦身：在进入 AES 绞肉机前，先用最高等级(9)榨干文本水分
    compressed_data = zlib.compress(plaintext.encode('utf-8'), level=9)
    
    # 加密压缩后的高密度数据
    ciphertext, tag = cipher.encrypt_and_digest(compressed_data)
    
    # 紧凑格式输出
    n = base64.b64encode(cipher.nonce).decode('utf-8')
    t = base64.b64encode(tag).decode('utf-8')
    c = base64.b64encode(ciphertext).decode('utf-8')
    return f"{n}.{t}.{c}"

def decrypt_aes_gcm(payload_str: str, key_hex: str) -> str:
    # 防御性清理
    payload_str = payload_str.replace("[VC-S]", "").replace("[VC-STEGO]", "")
    
    if payload_str.startswith("{"):
        data = json.loads(payload_str)
        nonce = base64.b64decode(data['n'])
        tag = base64.b64decode(data['t'])
        ciphertext = base64.b64decode(data['c'])
    else:
        parts = payload_str.split('.')
        nonce = base64.b64decode(parts[0])
        tag = base64.b64decode(parts[1])
        ciphertext = base64.b64decode(parts[2])
        
    cipher = AES.new(key_hex.encode('utf-8'), AES.MODE_GCM, nonce=nonce)
    
    # 解密得到压缩后的二进制流
    decrypted_compressed_data = cipher.decrypt_and_verify(ciphertext, tag)
    
    # 🌟 核心还原：解压缩二进制流，恢复原始文本
    return zlib.decompress(decrypted_compressed_data).decode('utf-8')

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
    patterns = np.array([[[0, 1], [0, 1]], [[1, 0], [1, 0]], [[0, 0], [1, 1]], [[1, 1], [0, 0]], [[0, 1], [1, 0]], [[1, 0], [0, 1]]], dtype=np.uint8)
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

def generate_vc_shares_from_key(key_text):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(key_text)
    qr.make(fit=True)
    source_arr = np.array(qr.make_image(fill_color="black", back_color="white").convert('1'), dtype=bool)
    return apply_visual_crypto(source_arr)


# ================= 🚀 隐写术核心逻辑 (Steganography) =================

def generate_stego_qr_base64(payload_json: str):
    """
    隐写生成逻辑
    """
    # 🌟 隐私限制与体积极限压缩：使用仅 10 个字符的极简通用短链，切断与 GitHub 源码的关联
    bait_url = "https://g.cn"
    
    stego_content = f"{bait_url}#[VC-S]{payload_json}"
    
    qr = segno.make(stego_content, error='M') 
    
    buff = io.BytesIO()
    qr.save(buff, kind='png', scale=10, dark="black", light="white", border=4)
    return "data:image/png;base64," + base64.b64encode(buff.getvalue()).decode()


# ================= 🚀 业务接口 =================

@app.post("/generate")
async def generate(text: str = Form(...)):
    try:
        aes_key = secrets.token_hex(8) 
        encrypted_payload = encrypt_aes_gcm(text, aes_key)
        ciphertext_qr_b64 = generate_stego_qr_base64(encrypted_payload)
        img1, img2, preview_clean = generate_vc_shares_from_key(aes_key)
        
        return {
            "status": "success", 
            "ciphertext_qr": ciphertext_qr_b64, 
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
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        detect = cv2.QRCodeDetector()
        val, _, _ = detect.detectAndDecode(img)
        
        if not val:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            val, _, _ = detect.detectAndDecode(thresh)

        if val and "[VC-S]" in val:
            hidden_json = val.split("[VC-S]")[1]
            return {"status": "success", "content": hidden_json}
        
        return {"status": "fail", "error": "未在二维码中检测到隐写载荷。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decode")
async def decode_vc_key(file: UploadFile = File(...)):
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
                return {"status": "success", "content": res, "cleanImage": img_to_base64(Image.fromarray(clean, mode='L'))}
        
        return {"status": "fail", "error": "物理密钥识别失败，请检查对齐。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decrypt_payload")
async def final_decrypt(payload: str = Form(...), key: str = Form(...)):
    try:
        plaintext = decrypt_aes_gcm(payload, key)
        return {"status": "success", "content": plaintext}
    except Exception as e:
        return {"status": "fail", "error": "解密或解压失败：密文与密钥不匹配，或数据已损坏。"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)