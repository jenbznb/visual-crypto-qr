import io
import base64
import secrets  # 更安全的随机数
import numpy as np
import qrcode
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageDraw

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def img_to_base64(img):
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

def add_alignment_marks(img_array):
    """
    在图像矩阵的四个角落添加十字准星对齐标记。
    这对物理打印至关重要。
    """
    h, w = img_array.shape
    # 标记的大小和线条粗细
    mark_size = 20
    thickness = 4
    
    # 定义一个画十字的函数
    def draw_cross(y_start, x_start):
        # 横线
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, 
                  x_start : x_start + mark_size] = 0 # 0=黑
        # 竖线
        img_array[y_start : y_start + mark_size, 
                  x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0

    # 左上
    draw_cross(0, 0)
    # 右上
    draw_cross(0, w - mark_size)
    # 左下
    draw_cross(h - mark_size, 0)
    # 右下
    draw_cross(h - mark_size, w - mark_size)
    
    return img_array

def generate_visual_crypto(text_data):
    # 1. 生成高容错率二维码
    qr = qrcode.QRCode(
        version=None, # 自动版本
        error_correction=qrcode.constants.ERROR_CORRECT_H, # 30% 容错，关键！
        box_size=10,
        border=4,
    )
    qr.add_data(text_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('1')
    
    source_arr = np.array(qr_img)
    h, w = source_arr.shape
    
    # 2. 扩展画布：通常视觉加密会把 1 像素变 2x2
    # 我们加上 padding 留白给对齐标记
    padding = 20
    final_h = h * 2 + padding * 2
    final_w = w * 2 + padding * 2
    
    # 初始化两个图层 (255 = 白/透明)
    share_a = np.full((final_h, final_w), 255, dtype=np.uint8)
    share_b = np.full((final_h, final_w), 255, dtype=np.uint8)
    
    # 3. 加密过程
    for y in range(h):
        for x in range(w):
            pixel = source_arr[y, x] # True(白) 或 False(黑)
            
            # 2x2 像素块的图案模板 (每行代表一种 pattern)
            # 1=白(透), 0=黑(墨)
            patterns = [
                np.array([[0, 1], [0, 1]]), # 竖条
                np.array([[1, 0], [1, 0]]),
                np.array([[0, 0], [1, 1]]), # 横条
                np.array([[1, 1], [0, 0]]),
                np.array([[0, 1], [1, 0]]), # 对角
                np.array([[1, 0], [0, 1]])
            ]
            
            # 使用安全的随机数选择
            idx = secrets.randbelow(len(patterns))
            pat_a = patterns[idx] * 255 # 转为 0/255
            
            if pixel == 0: # 原图是黑色
                # 叠加后要是全黑 -> Share B 需要与 Share A 互补
                pat_b = 255 - pat_a
            else: # 原图是白色
                # 叠加后要是灰色 -> Share B 与 Share A 相同
                pat_b = pat_a
            
            # 填入大图 (注意加上 padding 偏移量)
            target_y = y * 2 + padding
            target_x = x * 2 + padding
            
            share_a[target_y:target_y+2, target_x:target_x+2] = pat_a
            share_b[target_y:target_y+2, target_x:target_x+2] = pat_b

    # 4. 添加对齐标记 (关键步骤)
    # 对齐标记必须在两张图上完全一致，且是黑色的
    share_a = add_alignment_marks(share_a)
    share_b = add_alignment_marks(share_b)

    # 5. 生成最终图片
    img_a = Image.fromarray(share_a, mode='L')
    img_b = Image.fromarray(share_b, mode='L')
    
    return img_a, img_b

@app.post("/generate")
async def generate(text: str = Form(...)):
    try:
        img1, img2 = generate_visual_crypto(text)
        return {
            "status": "success",
            "share1": img_to_base64(img1),
            "share2": img_to_base64(img2)
        }
    except Exception as e:
        print(e)
        return {"error": str(e)}