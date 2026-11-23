"""Render the downloaded deck PDF for visual QA and recorded slide previews."""
import sys,json
from pathlib import Path
import pymupdf
from PIL import Image,ImageOps,ImageDraw
pdf=pymupdf.open(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);files=[]
for i,page in enumerate(pdf):
 p=out/f'slide-{i+1:02}.png';page.get_pixmap(matrix=pymupdf.Matrix(2,2),alpha=False).save(p);files.append(str(p))
(out/'slides.json').write_text(json.dumps(files))
w=480;h=300;sheet=Image.new('RGB',(w*4,h*((len(files)+3)//4)),'#121b2c');d=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
 image=Image.open(f);image.thumbnail((480,270));x=(i%4)*w;y=(i//4)*h;sheet.paste(image,(x,y));d.text((x+10,y+280),str(i+1),fill='white')
sheet.save(out/'contact-sheet.jpg',quality=90)
print(json.dumps({'slides':len(files),'rendered':files}))
