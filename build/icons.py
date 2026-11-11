# Makes every app icon from your logo, brand/AK_Smarts_PDF_Tool.png.
# Run: python3 build/icon-notext.py (makes the logo without its name text, for small sizes), then python3 build/icons.py
# Small icons (favicon, header, phone home screen) use the logo without text, because the name can't be read
# that small. Large images (desktop app 256/512, social share image, splash) use the full logo with the name.
from PIL import Image, ImageDraw, ImageFont
import os
root = os.path.join(os.path.dirname(__file__), '..')
B = lambda n: os.path.join(root, 'brand', n)
full_src = Image.open(B('AK_Smarts_PDF_Tool.png')).convert('RGBA')
src = Image.open(B('AK_Smarts_PDF_icon.png')).convert('RGBA')
maskable = Image.open(B('AK_Smarts_PDF_icon_maskable.png')).convert('RGBA')

def rounded_of(im):
    S = im.size[0]
    m = Image.new('L', (S * 4, S * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, S * 4 - 1, S * 4 - 1), radius=int(S * 4 * 0.21), fill=255)
    out = im.copy(); out.putalpha(m.resize((S, S), Image.LANCZOS)); return out
rounded, full = rounded_of(src), rounded_of(full_src)
R = lambda im, n: im.resize((n, n), Image.LANCZOS)

out = os.path.join(root, 'public', 'icons'); os.makedirs(out, exist_ok=True)
for n in (32, 48, 64, 128, 192, 256, 512):
    R(rounded, n).save(os.path.join(out, f'icon-{n}.png'), optimize=True)
# the full logo with the name, for places where it is shown large
for n in (256, 512):
    R(full, n).save(os.path.join(out, f'logo-{n}.png'), optimize=True)
R(maskable, 512).save(os.path.join(out, 'icon-maskable-512.png'), optimize=True)
R(maskable, 192).save(os.path.join(out, 'icon-maskable-192.png'), optimize=True)
R(src.convert('RGB'), 180).save(os.path.join(out, 'apple-touch-icon.png'), optimize=True)
R(rounded, 256).save(os.path.join(root, 'public', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# file icon for PDFs opened with the app: a page with the logo badge
fi = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); d = ImageDraw.Draw(fi)
d.polygon([(48, 12), (164, 12), (212, 60), (212, 244), (48, 244)], fill=(255, 255, 255, 255), outline=(10, 70, 200, 255), width=8)
d.polygon([(164, 12), (164, 60), (212, 60)], fill=(225, 40, 50, 255))
fi.alpha_composite(R(rounded, 132), (64, 84))
for n in (16, 32, 48, 64, 128, 256):
    (fi if n == 256 else fi.resize((n, n), Image.LANCZOS)).save(os.path.join(out, f'pdf-file-{n}.png'), optimize=True)

# social share image (WhatsApp, Facebook, LinkedIn, X): 1200 x 630
def font(names, size):
    for n in names:
        for d in ('/usr/share/fonts/opentype/inter', '/usr/share/fonts/truetype/dejavu', 'C:/Windows/Fonts', '/Library/Fonts'):
            p = os.path.join(d, n)
            if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
og = Image.new('RGB', (1200, 630)); px = og.load()
for y in range(630):
    for x in range(1200):
        t = (x / 1200 * .6 + y / 630 * .4)
        px[x, y] = (int(4 + 4 * t), int(70 - 25 * t), int(214 - 60 * t))
og = og.convert('RGBA'); og.alpha_composite(R(full, 470), (70, 80))
d = ImageDraw.Draw(og)
d.text((590, 170), 'AK Smarts PDF', font=font(['Inter-Bold.otf', 'DejaVuSans-Bold.ttf', 'arialbd.ttf'], 66), fill='white')
f2 = font(['Inter-Medium.otf', 'DejaVuSans.ttf', 'arial.ttf'], 34)
for i, line in enumerate(['Read, edit, e-Sign and convert PDFs', 'Files stay on your device', 'Free · No sign-up needed']):
    d.text((594, 280 + i * 56), line, font=f2, fill=(220, 236, 255) if i else 'white')
og.convert('RGB').save(os.path.join(out, 'og-image.png'), optimize=True)

# desktop app (Windows installer / taskbar): big sizes show the full logo, small sizes the logo without text
dk = os.path.join(root, 'desktop', 'build'); os.makedirs(dk, exist_ok=True)
R(full, 512).save(os.path.join(dk, 'icon.png'), optimize=True)
import io, struct
def write_ico(path, images):
    # each size stored as PNG inside the .ico (supported since Windows Vista)
    blobs = []
    for im in images:
        bio = io.BytesIO(); im.save(bio, 'PNG', optimize=True); blobs.append((im.size[0], bio.getvalue()))
    head = struct.pack('<HHH', 0, 1, len(blobs)); off = 6 + 16 * len(blobs); dirs = b''; data = b''
    for n, bl in blobs:
        dirs += struct.pack('<BBBBHHII', n % 256, n % 256, 0, 0, 1, 32, len(bl), off + len(data)); data += bl
    open(path, 'wb').write(head + dirs + data)
write_ico(os.path.join(dk, 'icon.ico'), [R(full, 256)] + [R(rounded, n) for n in (128, 64, 48, 32, 24, 16)])
# file-type icon for .pdf files opened with the desktop app
write_ico(os.path.join(dk, 'pdf-file.ico'), [fi] + [fi.resize((n, n), Image.LANCZOS) for n in (128, 64, 48, 32, 16)])
print('icons written')
