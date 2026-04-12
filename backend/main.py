import io
import base64
import numpy as np
import qrcode
import cv2
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

app = FastAPI()

# --- 跨域配置 ---
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

# --- 工具函数：图片转 Base64 ---
def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

# --- 工具函数：添加对齐标记 ---
def add_alignment_marks(img_array):
    """Numpy 向量化添加十字准星对齐标记"""
    h, w = img_array.shape
    mark_size = 20
    thickness = 4
    corners = [(0, 0), (0, w - mark_size), (h - mark_size, 0), (h - mark_size, w - mark_size)]
    for y_start, x_start in corners:
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, x_start : x_start + mark_size] = 0
        img_array[y_start : y_start + mark_size, x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

# --- 工具函数：生成净化后的预览图 ---
def purify_image_for_preview(stacked_gray, scale=0.5):
    """提取三步净化算法，专门用于生成前端预览图"""
    # 1. INTER_AREA 逆向融合
    dim = (int(stacked_gray.shape[1] * scale), int(stacked_gray.shape[0] * scale))
    resized = cv2.resize(stacked_gray, dim, interpolation=cv2.INTER_AREA)
    
    # 2. 全局阈值二值化 (强制去除50%灰度)
    _, thresh = cv2.threshold(resized, 127, 255, cv2.THRESH_BINARY)
    
    # 3. 形态学开运算
    kernel = np.ones((3,3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    # 转为 base64
    pil_img = Image.fromarray(opening, mode='L')
    return img_to_base64(pil_img)
    
# ================= 核心加密逻辑 (视觉密码算法) =================
def apply_visual_crypto(source_arr):
    """
    核心：接收布尔矩阵，返回两张 2x2 扩充的噪点分片
    """
    h, w = source_arr.shape
    
    # 1. 2x2 模式模具定义
    patterns = np.array([
        [[0, 1], [0, 1]], [[1, 0], [1, 0]], [[0, 0], [1, 1]], 
        [[1, 1], [0, 0]], [[0, 1], [1, 0]], [[1, 0], [0, 1]]
    ], dtype=np.uint8)
    
    # 2. 像素打散逻辑
    rng = np.random.randint(0, 6, size=(h, w))
    pat_a = patterns[rng]
    mask = source_arr[:, :, np.newaxis, np.newaxis]
    pat_b = np.where(mask, pat_a, 1 - pat_a)
    
    final_h, final_w = h * 2, w * 2
    share_a_img = pat_a.swapaxes(1, 2).reshape(final_h, final_w) * 255
    share_b_img = pat_b.swapaxes(1, 2).reshape(final_h, final_w) * 255
    
    # 3. 增加边框填充与对齐标记
    padding = 20
    full_a = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
    full_b = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
   # 修改 apply_visual_crypto 的最后部分
    full_a[padding:-padding, padding:-padding] = share_a_img
    full_b[padding:-padding, padding:-padding] = share_b_img
    
    # --- 新增：生成完美的净化预览图 ---
    # 物理叠加等同于取矩阵最小值
    stacked = np.minimum(full_a, full_b)
    preview_clean_b64 = purify_image_for_preview(stacked)
    
    img1 = Image.fromarray(add_alignment_marks(full_a), mode='L')
    img2 = Image.fromarray(add_alignment_marks(full_b), mode='L')
    
    # 修改返回值，增加第三个参数
    return img1, img2, preview_clean_b64

# ================= 业务逻辑：文本处理 =================
def generate_visual_crypto_from_text(text_data):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(text_data)
    qr.make(fit=True)
    source_arr = np.array(qr.make_image(fill_color="black", back_color="white").convert('1'), dtype=bool)
    return apply_visual_crypto(source_arr)

# ================= 路由接口 =================

@app.post("/generate")
async def generate(text: str = Form(...)):
    """处理文本转二维码加密"""
    try:
       # 接收 preview_clean
        img1, img2, preview_clean = generate_visual_crypto_from_text(text)
        return {"status": "success", "share1": img_to_base64(img1), "share2": img_to_base64(img2), "previewClean": preview_clean}
    except Exception as e:
        print(f"Generate Error: {e}")
        return {"status": "fail", "error": str(e)}

@app.post("/generate_image")
async def generate_image(file: UploadFile = File(...)):
    """处理直接上传图片加密"""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        if img is None:
            return {"status": "fail", "error": "无法解析图片文件"}

        # 尺寸控制：防止过大图片导致计算崩溃
        max_size = 250
        h, w = img.shape
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_NEAREST)

        # 二值化
        _, thresh = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
        source_arr = np.array(thresh, dtype=bool)

        img1, img2, preview_clean = apply_visual_crypto(source_arr)
        return {"status": "success", "share1": img_to_base64(img1), "share2": img_to_base64(img2), "previewClean": preview_clean}
    except Exception as e:
        print(f"Generate Image Error: {e}")
        return {"status": "fail", "error": str(e)}

# ================= 智能识别管道 (解密) =================

def try_decode(img_bgr):
    detect = cv2.QRCodeDetector()
    scales = [0.5, 0.33, 0.25, 0.2, 1.0]

    for scale in scales:
        dim = (int(img_bgr.shape[1] * scale), int(img_bgr.shape[0] * scale))
        resized = cv2.resize(img_bgr, dim, interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
        
        value, _, _ = detect.detectAndDecode(thresh)
        if value:
            return value, thresh  # <--- 修改：返回净化数组

        kernel = np.ones((3,3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        value_open, _, _ = detect.detectAndDecode(opening)
        if value_open:
            return value_open, opening # <--- 修改：返回净化数组
    return None, None

@app.post("/decode")
async def decode_qr(file: UploadFile = File(...)):
    """处理解密与二维码识别"""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "fail", "error": "无法解析图片文件"}

        result, clean_arr = try_decode(img)
        if result and clean_arr is not None:
            clean_pil = Image.fromarray(clean_arr, mode='L')
            clean_b64 = img_to_base64(clean_pil)
            return {"status": "success", "content": result, "cleanImage": clean_b64} # <--- 返回 cleanImage
        else:
            return {"status": "fail", "error": "无法识别二维码。请尝试：\n1. 确保两张图完全对齐\n2. 尝试微调偏移量"}
    except Exception as e:
        print(f"Decode Error: {e}")
        return {"status": "fail", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
