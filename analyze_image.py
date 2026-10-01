from PIL import Image
import numpy as np

img = Image.open("C:/Users/Jeremiah/.gemini/antigravity/brain/2c0033e3-822b-412a-99ff-87afd61c733a/.user_uploaded/media_1790869379458.png").convert("RGB")
arr = np.array(img)

# Find green pixels (roughly #22c55e -> R:34, G:197, B:94, but in screenshot it might vary)
# Let's just find pixels where Green > Red + Blue
green_mask = (arr[:, :, 1] > arr[:, :, 0] + 50) & (arr[:, :, 1] > arr[:, :, 2] + 50)
coords = np.argwhere(green_mask)

if len(coords) > 0:
    min_y, min_x = coords.min(axis=0)
    max_y, max_x = coords.max(axis=0)
    width = max_x - min_x
    height = max_y - min_y
    print(f"Green circle bounding box: {width}x{height}")
else:
    print("No green circle found")

# Estimate grid size by finding blueish lines (e.g., #e2e8f0 or similar grid color)
print(f"Image shape: {arr.shape}")
