# src/preprocess_images.py

import os
import cv2
from tqdm import tqdm

# Paths
root = "data"
splits = ["train", "val", "test"]
input_dirs = {
    "train": os.path.join(root, "training", "training_words"),
    "val": os.path.join(root, "validation", "validation_words"),
    "test": os.path.join(root, "testing", "testing_words"),
}
output_dirs = {
    "train": os.path.join(root, "processed", "train"),
    "val": os.path.join(root, "processed", "val"),
    "test": os.path.join(root, "processed", "test"),
}

# Create output folders if not exist
for d in output_dirs.values():
    os.makedirs(d, exist_ok=True)

# Preprocessing function
def preprocess_image(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)  # Grayscale
    if img is None:
        return None
    # Denoise
    img = cv2.bilateralFilter(img, 9, 75, 75)
    # Adaptive threshold
    img = cv2.adaptiveThreshold(img, 255,
                                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY_INV, 15, 8)
    # Optional: resize to fixed height
    h = 64
    ratio = h / img.shape[0]
    w = int(img.shape[1] * ratio)
    img = cv2.resize(img, (w, h))
    return img

# Process all images
for split in splits:
    in_dir = input_dirs[split]
    out_dir = output_dirs[split]
    
    for file in tqdm(os.listdir(in_dir), desc=f"Processing {split} images"):
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            img_path = os.path.join(in_dir, file)
            img = preprocess_image(img_path)
            if img is not None:
                cv2.imwrite(os.path.join(out_dir, file), img)

print("✅ Preprocessing complete. Images saved in 'data/processed/'")
