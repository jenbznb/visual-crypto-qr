import io
import base64
import secrets
import numpy as np
import qrcode
import cv2  # 引入 OpenCV
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
    """
    接收前端合成好的图片，使用 OpenCV 进行处理和识别
    """
    try:
        # 1. 读取图片文件
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "fail", "error": "无法解析图片数据"}

        # 2. 图像预处理 (OpenCV 核心魔法)
        # 转为灰度图
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 二值化处理 (Thresholding)
        # 视觉加密的原理：黑色是0，白色区域其实是噪点(约等于127灰度)
        # 我们设置阈值为 100：低于100的变成纯黑，高于100的变成纯白
        # 这样就把噪点全部“漂白”了，只剩下清晰的二维码图案
        _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)

        # 3. 识别二维码
        detect = cv2.QRCodeDetector()
        value, points, straight_qrcode = detect.detectAndDecode(thresh)

        if value:
            return {"status": "success", "content": value}
        else:
            # 如果标准方法失败，尝试更激进的形态学处理再试一次
            kernel = np.ones((3,3), np.uint8)
            opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
            value2, _, _ = detect.detectAndDecode(opening)
            if value2:
                 return {"status": "success", "content": value2}
            
            return {"status": "fail", "error": "无法识别二维码，请确保图片对齐"}

    except Exception as e:
        print(f"Decode Error: {e}")
        return {"status": "fail", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
