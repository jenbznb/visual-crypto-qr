import io
import base64
import numpy as np
import qrcode
import cv2
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import json
import zlib  # 🌟 重新引入：底层极限压缩引擎

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

# --- 工具函数：图片转换 ---
def img_to_base64(img):
    """
    将 PIL Image 对象转换为 Base64 编码的 Data URL
    """
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

# --- 视觉密码核心 (VC) ---
def add_alignment_marks(img_array):
    """
    在图像矩阵的四个角添加十字对齐标记，方便物理打印叠合
    """
    h, w = img_array.shape
    mark_size = 20
    thickness = 4
    corners = [(0, 0), (0, w - mark_size), (h - mark_size, 0), (h - mark_size, w - mark_size)]
    for y_start, x_start in corners:
        # 横线
        img_array[y_start + mark_size//2 - thickness//2 : y_start + mark_size//2 + thickness//2, x_start : x_start + mark_size] = 0
        # 竖线
        img_array[y_start : y_start + mark_size, x_start + mark_size//2 - thickness//2 : x_start + mark_size//2 + thickness//2] = 0
    return img_array

def apply_visual_crypto(source_arr):
    """
    将源黑白二维码图像矩阵分割成两张视觉密码学分片 (2,2 VC)
    """
    h, w = source_arr.shape
    # 定义 2x2 子像素模式 (1代表白，0代表黑)
    patterns = np.array([
        [[0, 1], [0, 1]], 
        [[1, 0], [1, 0]], 
        [[0, 0], [1, 1]], 
        [[1, 1], [0, 0]], 
        [[0, 1], [1, 0]], 
        [[1, 0], [0, 1]]
    ], dtype=np.uint8)
    
    # 为每个像素随机选择一个基本模式
    rng = np.random.randint(0, 6, size=(h, w))
    pat_a = patterns[rng]
    
    # 遮罩矩阵，若源图像点为1(白色)，则分片B与A相同(叠合后也是白色)
    # 若源图像点为0(黑色)，则分片B与A完全相反(叠合后变为全黑)
    mask = source_arr[:, :, np.newaxis, np.newaxis]
    pat_b = np.where(mask, pat_a, 1 - pat_a)
    
    # 构建最终的扩展子像素图像（尺寸放大两倍）
    final_h, final_w = h * 2, w * 2
    share_a_img = pat_a.swapaxes(1, 2).reshape(final_h, final_w) * 255
    share_b_img = pat_b.swapaxes(1, 2).reshape(final_h, final_w) * 255
    
    # 添加边缘留白（Padding）以保障二维码扫描边缘保护区（Quiet Zone）
    padding = 20
    full_a = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
    full_b = np.full((final_h + padding*2, final_w + padding*2), 255, dtype=np.uint8)
    full_a[padding:-padding, padding:-padding] = share_a_img
    full_b[padding:-padding, padding:-padding] = share_b_img
    
    # 模拟物理叠合（取最小值：黑像素覆盖白像素）
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
    先对安全机密进行zlib极限压缩并Base64编码，再隐写进诱导性前缀中，最终生成源二维码矩阵
    """
    bait_url = "https://g.cn"
    
    # 🌟 核心优化：在生成二维码前，对文本/流进行 zlib (level 9) 压缩，压榨空间
    compressed_bytes = zlib.compress(payload_str.encode('utf-8'), level=9)
    compressed_b64 = base64.b64encode(compressed_bytes).decode('utf-8')
    
    # 构造隐写协议文本
    stego_content = f"{bait_url}#[VC-S]{compressed_b64}"
    
    # 采用 H 级别错误纠正（ERROR_CORRECT_H，容错 30%）
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
    
    # 转为 Base64 以供底图预览
    buffered = io.BytesIO()
    qr_img.save(buffered, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
    
    return source_arr, qr_b64


# ================= 🚀 业务接口 =================

@app.post("/generate")
async def generate(text: str = Form(...)):
    """
    主生成端：接收机密信息 -> Zlib极限压缩并制作隐写二维码 -> 视觉密码学直接分片
    """
    try:
        # 直接把压缩后的机密写入隐写矩阵
        source_arr, stego_qr_b64 = generate_stego_qr_matrix_and_base64(text)
        
        # 将二维码图分割成物理分片
        img1, img2, preview_clean = apply_visual_crypto(source_arr)
        
        return {
            "status": "success", 
            "ciphertext_qr": stego_qr_b64, # 保持键名兼容前端
            "share1": img_to_base64(img1), 
            "share2": img_to_base64(img2), 
            "previewClean": preview_clean
        }
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decode_normal_qr")
async def extract_stego_data(file: UploadFile = File(...)):
    """
    直扫解析：直接上传正常的诱导二维码，进行zlib解压后还原原始隐藏载荷
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

        if val and "[VC-S]" in val:
            hidden_b64 = val.split("[VC-S]")[1]
            try:
                # 🌟 重新引入：Base64 还原 -> zlib 解压并还原
                compressed_bytes = base64.b64decode(hidden_b64)
                hidden_content = zlib.decompress(compressed_bytes).decode('utf-8')
                return {"status": "success", "content": hidden_content}
            except Exception:
                # 兼容性防御：如果解压失败，退回按明文返回
                return {"status": "success", "content": hidden_b64}
        
        return {"status": "fail", "error": "未在二维码中检测到隐写协议 [VC-S] 头。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decode")
async def decode_vc_key(file: UploadFile = File(...)):
    """
    叠合解析：接收两张分片叠合后的组合图 -> 清洗识别 -> zlib解压还原 -> 直接呈现安全数据
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        detect = cv2.QRCodeDetector()
        
        # 多尺度、形态学清洗去噪循环
        for sc in [0.5, 1.0, 0.33]:
            dim = (int(img.shape[1]*sc), int(img.shape[0]*sc))
            resized = cv2.resize(img, dim, interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
            kernel = np.ones((3,3), np.uint8)
            clean = cv2.morphologyEx(cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)
            
            res, _, _ = detect.detectAndDecode(clean)
            if res:
                # 检查是否包含隐写协议
                if "[VC-S]" in res:
                    hidden_b64 = res.split("[VC-S]")[1]
                    try:
                        # 🌟 zlib 解密解压还原
                        compressed_bytes = base64.b64decode(hidden_b64)
                        hidden_content = zlib.decompress(compressed_bytes).decode('utf-8')
                    except Exception:
                        hidden_content = hidden_b64
                    
                    return {
                        "status": "success", 
                        "content": hidden_content, 
                        "cleanImage": img_to_base64(Image.fromarray(clean, mode='L'))
                    }
                else:
                    return {
                        "status": "success", 
                        "content": res, 
                        "cleanImage": img_to_base64(Image.fromarray(clean, mode='L'))
                    }
        
        return {"status": "fail", "error": "叠合条码识别失败，请检查对齐微调或增大光照对比度。"}
    except Exception as e:
        return {"status": "fail", "error": str(e)}

@app.post("/decrypt_payload")
async def final_decrypt(payload: str = Form(...), key: str = Form(...)):
    """
    向下兼容降落伞：如果有旧版本客户端发起历史接口，我们尝试做 zlib 还原后返回
    """
    try:
        clean_payload = payload.replace("[VC-S]", "")
        try:
            compressed_bytes = base64.b64decode(clean_payload)
            clean_plaintext = zlib.decompress(compressed_bytes).decode('utf-8')
        except Exception:
            clean_plaintext = clean_payload
        return {"status": "success", "content": clean_plaintext}
    except Exception as e:
        return {"status": "fail", "error": f"转换失败：{str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)