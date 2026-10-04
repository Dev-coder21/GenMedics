#!/usr/bin/env python3
"""
Fine-tune TrOCR on prescription dataset for improved handwriting recognition.
Usage: python src/train_ocr.py --train_dir data/training/training_words --train_csv data/training/training_labels.csv --val_dir data/validation/validation_words --val_csv data/validation/validation_labels.csv --output_dir model/trocr-handwritten-finetuned --epochs 10
"""

import argparse
import os
import pandas as pd
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    TrOCRProcessor, 
    VisionEncoderDecoderModel, 
    Seq2SeqTrainer, 
    Seq2SeqTrainingArguments,
    default_data_collator
)
import evaluate
from pathlib import Path
import cv2
import numpy as np

class PrescriptionDataset(Dataset):
    def __init__(self, image_dir, csv_file, processor, max_target_length=128):
        self.image_dir = Path(image_dir)
        self.processor = processor
        self.max_target_length = max_target_length
        
        # Load CSV with image filenames and text labels
        self.df = pd.read_csv(csv_file)
        print(f"Loaded {len(self.df)} samples from {csv_file}")
        
        # Filter out missing images
        valid_samples = []
        for _, row in self.df.iterrows():
            img_path = self.image_dir / row['IMAGE']
            if img_path.exists():
                valid_samples.append(row)
            else:
                print(f"Warning: Missing image {img_path}")
        
        self.samples = valid_samples
        print(f"Found {len(self.samples)} valid samples")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        
        # Load and preprocess image
        img_path = self.image_dir / sample['IMAGE']
        image = Image.open(img_path).convert('RGB')
        
        # Light preprocessing to help OCR
        img_cv = np.array(image)[:, :, ::-1]  # RGB to BGR
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # CLAHE for contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # Convert back to RGB PIL
        gray_rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        image = Image.fromarray(gray_rgb)
        
        # Get text label (use MEDICINE_NAME or fallback to generic name)
        text = str(sample.get('MEDICINE_NAME', sample.get('GENERIC_NAME', ''))).strip()
        
        # Process with TrOCR processor
        pixel_values = self.processor(image, return_tensors="pt").pixel_values
        labels = self.processor.tokenizer(
            text, 
            padding="max_length", 
            max_length=self.max_target_length, 
            truncation=True, 
            return_tensors="pt"
        ).input_ids
        
        return {
            "pixel_values": pixel_values.squeeze(),
            "labels": labels.squeeze()
        }

def compute_metrics(eval_pred):
    """Compute CER and WER metrics."""
    try:
        import jiwer
        cer_metric = evaluate.load("cer")
        
        predictions, labels = eval_pred
        
        # Decode predictions and labels
        decoded_preds = processor.batch_decode(predictions, skip_special_tokens=True)
        
        # Replace -100 in labels (padding token)
        labels = np.where(labels != -100, labels, processor.tokenizer.pad_token_id)
        decoded_labels = processor.batch_decode(labels, skip_special_tokens=True)
        
        # Compute CER
        cer = cer_metric.compute(predictions=decoded_preds, references=decoded_labels)
        
        # Compute WER using jiwer
        try:
            wer = jiwer.wer(decoded_labels, decoded_preds)
        except Exception:
            wer = 1.0  # fallback if WER computation fails
        
        return {"cer": cer, "wer": wer}
    
    except Exception as e:
        print(f"Metrics computation failed: {e}")
        return {"cer": 1.0, "wer": 1.0}

def main():
    parser = argparse.ArgumentParser(description="Fine-tune TrOCR on prescription dataset")
    parser.add_argument("--train_dir", required=True, help="Training images directory")
    parser.add_argument("--train_csv", required=True, help="Training labels CSV file")
    parser.add_argument("--val_dir", required=True, help="Validation images directory")
    parser.add_argument("--val_csv", required=True, help="Validation labels CSV file")
    parser.add_argument("--output_dir", required=True, help="Output directory for fine-tuned model")
    parser.add_argument("--base_model", default="microsoft/trocr-base-handwritten", help="Base TrOCR model")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=5e-5, help="Learning rate")
    parser.add_argument("--per_device_batch_size", type=int, default=4, help="Batch size per device")
    parser.add_argument("--gradient_accumulation_steps", type=int, default=2, help="Gradient accumulation steps")
    parser.add_argument("--warmup_steps", type=int, default=100, help="Warmup steps")
    parser.add_argument("--save_steps", type=int, default=500, help="Save checkpoint every N steps")
    parser.add_argument("--eval_steps", type=int, default=500, help="Evaluate every N steps")
    
    args = parser.parse_args()
    
    # Check if directories exist
    for path in [args.train_dir, args.val_dir]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Directory not found: {path}")
    
    for path in [args.train_csv, args.val_csv]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"CSV file not found: {path}")
    
    # Load processor and model
    global processor
    print(f"Loading base model: {args.base_model}")
    processor = TrOCRProcessor.from_pretrained(args.base_model)
    model = VisionEncoderDecoderModel.from_pretrained(args.base_model)
    
    # Set special tokens
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.vocab_size = model.config.decoder.vocab_size
    
    # Create datasets
    print("Creating datasets...")
    train_dataset = PrescriptionDataset(args.train_dir, args.train_csv, processor)
    val_dataset = PrescriptionDataset(args.val_dir, args.val_csv, processor)
    
    if len(train_dataset) == 0:
        raise ValueError("No training samples found!")
    
    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")
    
    # Training arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.per_device_batch_size,
        per_device_eval_batch_size=args.per_device_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        predict_with_generate=True,
        eval_strategy="steps",  # Changed from evaluation_strategy
        eval_steps=args.eval_steps,
        save_steps=args.save_steps,
        logging_steps=100,
        save_total_limit=3,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        warmup_steps=args.warmup_steps,
        fp16=torch.cuda.is_available(),
        dataloader_pin_memory=False,
        load_best_model_at_end=True,
        metric_for_best_model="cer",
        greater_is_better=False,
        report_to=[],  # Changed from None to empty list
    )
    
    # Create trainer
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset if len(val_dataset) > 0 else None,
        data_collator=default_data_collator,
        compute_metrics=compute_metrics,
    )
    
    # Train
    print("Starting training...")
    trainer.train()
    
    # Save final model
    print(f"Saving final model to {args.output_dir}")
    trainer.save_model()
    processor.save_pretrained(args.output_dir)
    
    # Final evaluation
    if len(val_dataset) > 0:
        print("Running final evaluation...")
        eval_results = trainer.evaluate()
        print(f"Final CER: {eval_results.get('eval_cer', 'N/A'):.4f}")
        print(f"Final WER: {eval_results.get('eval_wer', 'N/A'):.4f}")
    
    print("Training completed!")

if __name__ == "__main__":
    main()
