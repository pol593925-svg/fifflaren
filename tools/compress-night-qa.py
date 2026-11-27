from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'graphics-qa'
for name in ['mines-night-day','mines-night-moon','mines-night-flashlight','mines-owner-view','mines-detonation']:
    image=Image.open(root/(name+'.png')).convert('RGB')
    image.thumbnail((1440,810),Image.Resampling.LANCZOS)
    image.save(root/(name+'-review.jpg'),quality=90,optimize=True)
