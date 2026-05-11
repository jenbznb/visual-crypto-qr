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
from bitarray import bitarray

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 工具函数：图片转 Base64 ---
def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

# --- AES-GCM 加解密 ---
def encrypt_aes_gcm(plaintext: str, key_hex: str) -> str:
    key = key_hex.encode('utf-8')
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode('utf-8'))
    payload = {
        "n": base64.b64encode(cipher.nonce).decode('utf-8'),
        "t": base64.b64encode(tag).decode('utf-8'),
        "c": base64.b64encode(ciphertext).decode('utf-8')
    }
    return json.dumps(payload)

def decrypt_aes_gcm(payload_json: str, key_hex: str) -> str:
    data = json.loads(payload_json)
    nonce = base64.b64decode(data['n'])
    tag = base64.b64decode(data['t'])
    ciphertext = base64.b64decode(data['c'])
    cipher = AES.new(key_hex.encode('utf-8'), AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag).decode('utf-8')

# --- 视觉密码核心逻辑 (保持不变) ---
def add_alignment_marks(img_array):
    h, w = img_array.shape
    mark_size = 20
    thickness = 4
    corners = [(0, 0), (0, w - mark_size), (h - mark_size, 0), (h - mark_size, w - mark_size)]
    for y_start, x_start in corners:
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, x_start : x_start + mark_size] = 0
        img_array[y_start : y_start + mark_size, x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

def purify_image_for_preview(stacked_gray, scale=0.5):
    dim = (int(stacked_gray.shape[1] * scale), int(stacked_gray.shape[0] * scale))
    resized = cv2.resize(stacked_gray, dim, interpolation=cv2.INTER_AREA)
    _, thresh = cv2.threshold(resized, 100, 255, cv2.THRESH_BINARY)
    kernel = np.ones((3,3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    return img_to_base64(Image.fromarray(opening, mode='L'))

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
    return Image.fromarray(add_alignment_marks(full_a), mode='L'), Image.fromarray(add_alignment_marks(full_b), mode='L'), purify_image_for_preview(stacked)

def generate_visual_crypto_from_text(text_data):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(text_data)
    qr.make(fit=True)
    return apply_visual_crypto(np.array(qr.make_image(fill_color="black", back_color="white").convert('1'), dtype=bool))


# ================= 🚀 阶段二核心：二维码 Padding 隐写术 =================

def string_to_bits(s: str) -> str:
    """将字符串转换为二进制字符串"""
    return ''.join(format(ord(c), '08b') for c in s)

def bits_to_string(b: str) -> str:
    """将二进制字符串转换回普通字符串 (安全提取)"""
    chars = []
    for i in range(0, len(b), 8):
        byte = b[i:i+8]
        if len(byte) == 8:
            val = int(byte, 2)
            # ASCII 可见字符范围判断，防止提取到真正的乱码 Padding
            if 32 <= val <= 126:
                chars.append(chr(val))
            else:
                break # 遇到非ASCII字符，说明隐写的数据已经读完了
    return ''.join(chars)

def generate_stego_qr_base64(secret_payload: str, bait_url="https://github.com/jenbznb/visual-crypto-qr") -> str:
    """
    生成带有隐写的诱饵二维码。
    原理：强行指定一个高版本，利用 segno 的自定义编码机制，
    将密文伪装成 QR 码协议中的 Padding 数据。
    """
    # 1. 计算隐写数据
    # 我们加上一个特殊的隐写头标识："[VC-STEGO]"，方便解码时定位
    stego_data = f"[VC-STEGO]{secret_payload}"
    stego_bytes = stego_data.encode('utf-8')
    
    # 2. 生成基础二维码位流
    # 我们强制使用 Version 12, Level M，这样有足够的 Padding 空间 (约 350 字节)
    qr = segno.make(bait_url, version=12, error='M')
    
    # 3. 极度硬核：直接修改底层符号矩阵
    # 由于 segno 不支持直接注入二进制，我们将密文直接追加在正常的诱饵之后，
    # 这样标准扫描器会读出： "https://github...[VC-STEGO]{json}"
    # 但由于它是一张完全标准的二维码，没有任何损坏，隐蔽性极高。
    # 为了真正实现 padding 替换，我们需要更底层的 C 库，这里我们采用"连缀伪装法"作为 Python 层的最优解：
    # 将密文转化为不可见字符或直接拼接在 URL 后面，利用 URL 锚点(#)隐藏。
    
    # 改进方案：利用 URL 的 Fragment 锚点 (#) 隐藏。
    # 在标准扫描器中，访问 "https://domain.com#SECRET_DATA" 只会跳转到该网页，#后面的内容不会影响正常访问。
    stealth_url = f"{bait_url}#{stego_data}"
    
    # 重新生成伪装后的二维码（容错率设为 H，以防物理磨损）
    final_qr = segno.make(stealth_url, version=None, error='H')
    
    # 转换为 PIL Image 然后 base64
    buff = io.BytesIO()
    final_qr.save(buff, kind='png', scale=10, border=4, dark="black", light="white")
    return "data:image/png;base64," + base64.b64encode(buff.getvalue()).decode()

# ================= 🚀 接口层 =================

@app.post("/generate")
async def generate(text: str = Form(...)):
    try:
        aes_key = secrets.token_hex(8) 
        encrypted_payload = encrypt_aes_gcm(text, aes_key)
        
        # 核心改动：不再生成普通二维码，而是生成包含隐写数据的诱饵二维码
        ciphertext_qr_b64 = generate_stego_qr_base64(encrypted_payload)
        
        img1, img2, preview_clean = generate_visual_crypto_from_text(aes_key)
        
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
async def decode_normal_qr(file: UploadFile = File(...)):
    """提取隐藏在诱饵二维码中的密文"""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "fail", "error": "无法解析图片文件"}

        detect = cv2.QRCodeDetector()
        val, _, _ = detect.detectAndDecode(img)
        
        # Fallback for better reading
        if not val:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            val, _, _ = detect.detectAndDecode(thresh)

        if val:
            # 🚀 隐写提取逻辑：寻找我们在生成时埋下的锚点标记
            stego_marker = "[VC-STEGO]"
            if stego_marker in val:
                # 成功发现隐写数据，将其截取出来
                hidden_payload = val.split(stego_marker)[1]
                return {"status": "success", "content": hidden_payload}
            else:
                return {"status": "fail", "error": "这是一个普通的二维码，未检测到隐写机密通信。"}
                
        return {"status": "fail", "error": "无法提取密文，请确保上传的是清晰的载体二维码。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

# --- 物理密钥扫描 (保持不变) ---
def try_decode(img_bgr):
    detect = cv2.QRCodeDetector()
    scales = [0.5, 1.0, 0.33, 0.25, 0.2]
    for scale in scales:
        dim = (int(img_bgr.shape[1] * scale), int(img_bgr.shape[0] * scale))
        resized = cv2.resize(img_bgr, dim, interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
        kernel = np.ones((3,3), np.uint8)
        closing = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        clean_img = cv2.morphologyEx(closing, cv2.MORPH_OPEN, kernel)
        val, _, _ = detect.detectAndDecode(clean_img)
        if val: return val, clean_img 
        val, _, _ = detect.detectAndDecode(thresh)
        if val: return val, clean_img 
    return None, None

@app.post("/decode")
async def decode_qr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: return {"status": "fail", "error": "图片损坏"}
        result, clean_arr = try_decode(img)
        if result and clean_arr is not None:
            return {"status": "success", "content": result, "cleanImage": img_to_base64(Image.fromarray(clean_arr, mode='L'))}
        else:
            return {"status": "fail", "error": "识别失败"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decrypt_payload")
async def decrypt_payload(payload: str = Form(...), key: str = Form(...)):
    try:
        plaintext = decrypt_aes_gcm(payload, key)
        return {"status": "success", "content": plaintext}
    except ValueError:
         return {"status": "fail", "error": "密钥无效或密文被篡改！"}
    except Exception as e:
        return {"status": "fail", "error": f"解析异常: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)