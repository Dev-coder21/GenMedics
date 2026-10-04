import os
import pandas as pd
from PIL import Image
from tqdm import tqdm

root = "data"

splits = {
    "train": (os.path.join(root, "training", "training_words"),
              os.path.join(root, "training", "training_labels.csv")),
    "val":   (os.path.join(root, "validation", "validation_words"),
              os.path.join(root, "validation", "validation_labels.csv")),
    "test":  (os.path.join(root, "testing", "testing_words"),
              os.path.join(root, "testing", "testing_labels.csv")),
}

report = {}
for name, (img_dir, csv_path) in splits.items():
    df = pd.read_csv(csv_path)
    csv_files = set(df.iloc[:,0].astype(str).tolist())
    fs_files = set([f for f in os.listdir(img_dir) if f.lower().endswith(('.png','.jpg','.jpeg'))])
    missing = csv_files - fs_files
    extras  = fs_files - csv_files
    dup_csv = df.iloc[:,0].duplicated().sum()
    corrupt = []
    for f in tqdm(sorted(list(fs_files)), desc=f"Checking {name} images"):
        p = os.path.join(img_dir, f)
        try:
            Image.open(p).verify()
        except Exception:
            corrupt.append(f)
    report[name] = {
        "csv_rows": len(df),
        "files_on_disk": len(fs_files),
        "missing_from_disk": len(missing),
        "extra_on_disk": len(extras),
        "duplicate_names_in_csv": int(dup_csv),
        "corrupt_images": len(corrupt)
    }

print(report)
