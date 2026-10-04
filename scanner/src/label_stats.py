import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("data/training/training_labels.csv")
labels = df.iloc[:,1].astype(str).str.strip()

print("Unique labels:", labels.nunique())
print("Top 10 most frequent labels:\n", labels.value_counts().head(10))

lengths = labels.str.len()
plt.hist(lengths, bins=20)
plt.title("Label length distribution")
plt.xlabel("Characters")
plt.ylabel("Count")
plt.show()
