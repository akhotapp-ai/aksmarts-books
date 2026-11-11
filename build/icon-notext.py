# Makes brand/AK_Smarts_PDF_icon.png: the same icon without the name text at the bottom,
# with the graphic moved to the centre (small icons can't show text anyway).
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os
root = os.path.join(os.path.dirname(__file__), '..')
im = Image.open(os.path.join(root, 'brand', 'AK_Smarts_PDF_Tool.png')).convert('RGB')
a = np.array(im).astype(float); H, W = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
inside = np.zeros((H, W), bool); m = Image.new('L', (W, H), 0)
ImageDraw.Draw(m).rounded_rectangle((25, 25, W - 26, H - 26), radius=int(W * .15), fill=255); inside = np.array(m) > 0
skip = ((xx > 55) & (xx < 1215) & (yy > 95) & (yy < 925)) | ((yy > 925) & (yy < 1080) & (xx > 60) & (xx < 1195))
pts = inside & ~skip
X = xx[pts] / W; Y = yy[pts] / H
def feats(X, Y): return np.stack([X**i * Y**j for i in range(4) for j in range(4 - i)], 1)
F = feats(X, Y); bg = np.zeros_like(a)
for c in range(3):
    coef, *_ = np.linalg.lstsq(F, a[..., c][pts], rcond=None)
    bg[..., c] = (feats((xx / W).ravel(), (yy / H).ravel()) @ coef).reshape(H, W)
base = Image.fromarray(bg.clip(0, 255).astype('uint8'))
box = (55, 95, 1215, 925); g = im.crop(box)
mk = Image.new('L', g.size, 0); ImageDraw.Draw(mk).rectangle((60, 60, g.size[0] - 60, g.size[1] - 60), fill=255); mk = mk.filter(ImageFilter.GaussianBlur(30))
def compose(scale, name):
    out = base.copy(); w, h = int(g.size[0] * scale), int(g.size[1] * scale)
    out.paste(g.resize((w, h), Image.LANCZOS), ((W - w) // 2 + 0, (H - h) // 2), mk.resize((w, h)))
    out.save(os.path.join(root, 'brand', name))
compose(1.0, 'AK_Smarts_PDF_icon.png')           # app icon
compose(0.72, 'AK_Smarts_PDF_icon_maskable.png')  # Android adaptive icon (keeps inside the safe circle)
print('ok')
