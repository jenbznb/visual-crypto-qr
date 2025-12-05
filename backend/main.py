import io
import base64
import numpy as np
import qrcode
from fastapi import FastAPI, Form
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
        # 横线
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, 
                  x_start : x_start + mark_size] = 0
        # 竖线
        img_array[y_start : y_start + mark_size, 
                  x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

def generate_visual_crypto(text_data):
    # 1. 生成二维码
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(text_data)
    qr.make(fit=True)
    source_arr = np.array(qr.make_image(fill_color="black", back_color="white").convert('1'), dtype=bool)
    h, w = source_arr.shape
    
    # 2. 预定义模式 (6种 2x2 矩阵)
    patterns = np.array([
        [[0, 1], [0, 1]], [[1, 0], [1, 0]], [[0, 0], [1, 1]], 
        [[1, 1], [0, 0]], [[0, 1], [1, 0]], [[1, 0], [0, 1]]
    ], dtype=np.uint8)

    # 3. 向量化计算
    rng = np.random.randint(0, 6, size=(h, w)) # 随机选择模式
    pat_a = patterns[rng] # (h, w, 2, 2)
    
    # 广播掩码: 如果原图是黑(False), pat_b = 反色(pat_a); 如果白(True), pat_b = pat_a
    mask = source_arr[:, :, np.newaxis, np.newaxis]
    pat_b = np.where(mask, pat_a, 1 - pat_a)
    
    # 4. 重排像素构建大图
    final_h, final_w = h * 2, w * 2
    share_a_img = pat_a.swapaxes(1, 2).reshape(final_h, final_w) * 255
    share_b_img = pat_b.swapaxes(1, 2).reshape(final_h, final_w) * 255
    
    # 5. 添加 Padding 和对齐标记
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
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
