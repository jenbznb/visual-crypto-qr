import io
import base64
import secrets
import numpy as np
import qrcode
import cv2
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hunyuan.ggff.net",
        "https://www.hunyuan.ggff.net",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

def add_alignment_marks(img_array):
    """Numpy 向量化添加对齐标记"""
    h, w = img_array.shape
    mark_size = 20
    thickness = 4
    corners = [(0, 0), (0, w - mark_size), (h - mark_size, 0), (h - mark_size, w - mark_size)]
    for y_start, x_start in corners:
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, x_start : x_start + mark_size] = 0
        img_array[y_start : y_start + mark_size, x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

def generate_visual_crypto(text_data):
    # 1. 生成高容错二维码
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(text_data)
    qr.make(fit=True)
    source_arr = np.array(qr.make_image(fill_color="black", back_color="white").convert('1'), dtype=bool)
    h, w = source_arr.shape
    
    # 2. 加密逻辑
    patterns = np.array([
        [[0, 1], [0, 1]], [[1, 0], [1, 0]], [[0, 0], [1, 1]], 
        [[1, 1], [0, 0]], [[0, 1], [1, 0]], [[1, 0], [0, 1]]
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
    
    return Image.fromarray(add_alignment_marks(full_a), mode='L'), Image.fromarray(add_alignment_marks(full_b), mode='L')

# ★★★ 核心修复：图像预处理管道 ★★★
def try_decode(img_bgr):
    detect = cv2.QRCodeDetector()
    
    # 策略 1: 暴力缩放 (最有效的反视觉加密手段)
    # 将图片缩小到不同的倍数。缩小的过程就是像素融合的过程。
    # 视觉加密通常是 2x2 像素块，所以缩小 0.5 倍是最直接的还原。
    scales = [0.5, 0.33, 0.25, 0.2, 1.0] # 优先尝试 0.5 (还原原始分辨率)

    for scale in scales:
        # 1. 计算新尺寸
        width = int(img_bgr.shape[1] * scale)
        height = int(img_bgr.shape[0] * scale)
        dim = (width, height)
        
        # 2. 缩放 (INTER_AREA 是重采样最好的算法，能有效去除莫尔纹和噪点)
        resized = cv2.resize(img_bgr, dim, interpolation=cv2.INTER_AREA)
        
        # 3. 转灰度
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # 4. 二值化 (清洗噪点)
        # 视觉加密的白色区域平均亮度约为 127。黑色区域为 0。
        # 我们取 100 作为分界线。高于 100 的全部变成纯白。
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
        
        # 尝试识别
        value, _, _ = detect.detectAndDecode(thresh)
        if value:
            print(f"Success at scale {scale}")
            return value

        # 5. 如果还不行，尝试形态学开运算 (去除小白点)
        kernel = np.ones((3,3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        value_open, _, _ = detect.detectAndDecode(opening)
        if value_open:
            print(f"Success at scale {scale} with morphology")
            return value_open

    return None

@app.post("/generate")
async def generate(text: str = Form(...)):
    try:
        img1, img2 = generate_visual_crypto(text)
        return {"status": "success", "share1": img_to_base64(img1), "share2": img_to_base64(img2)}
    except Exception as e:
        print(f"Generate Error: {e}")
        return {"error": str(e)}

@app.post("/decode")
async def decode_qr(file: UploadFile = File(...)):
    try:
        # 1. 读取图片
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "fail", "error": "无法解析图片文件"}

        # 2. 进入多重策略识别管道
        result = try_decode(img)

        if result:
            return {"status": "success", "content": result}
        else:
            return {"status": "fail", "error": "无法识别二维码。请尝试：\n1. 确保两张图完全对齐\n2. 上传更清晰的原图"}

    except Exception as e:
        print(f"Decode Error: {e}")
        return {"status": "fail", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
