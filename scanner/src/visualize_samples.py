import os
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image

train_img_dir = "data/training/training_words"
train_labels_file = "data/training/training_labels.csv"

df = pd.read_csv(train_labels_file)

fig, axes = plt.subplots(1, 5, figsize=(15, 5))
for i in range(5):
    img_name = df.iloc[i, 0]
    label = df.iloc[i, 1]
    img_path = os.path.join(train_img_dir, img_name)

    image = Image.open(img_path).convert("RGB")
    axes[i].imshow(image)
    axes[i].set_title(label)
    axes[i].axis("off")

plt.show()
