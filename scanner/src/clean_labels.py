import pandas as pd
import re

def normalize_label(s):
    s = str(s).strip()
    s = s.lower()
    s = s.replace('\u200b','')
    s = re.sub(r'\s+', ' ', s)
    return s

path = "data/training/training_labels.csv"
df = pd.read_csv(path)
df['clean_label'] = df.iloc[:,1].apply(normalize_label)
df.to_csv("data/training/training_labels_clean.csv", index=False)
print("Saved cleaned labels")