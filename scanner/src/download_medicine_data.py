# src/download_medicine_data.py

import pandas as pd
import requests
import json
from pathlib import Path
import time

def download_fda_drug_data():
    """
    Download drug data from FDA's openFDA API
    This provides real pharmaceutical data
    """
    print("Downloading FDA drug data...")
    
    # FDA API endpoint for drug products
    url = "https://api.fda.gov/drug/label.json"
    params = {
        'limit': 1000,  # Adjust based on your needs
        'search': 'openfda.brand_name:["*"]'
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        medicines = []
        for result in data.get('results', []):
            if 'openfda' in result and 'brand_name' in result['openfda']:
                brand_names = result['openfda']['brand_name']
                generic_name = result['openfda'].get('generic_name', ['Unknown'])[0] if result['openfda'].get('generic_name') else 'Unknown'
                
                # Extract additional information
                description = result.get('indications_and_usage', ['No description available'])[0] if result.get('indications_and_usage') else 'No description available'
                manufacturer = result['openfda'].get('manufacturer_name', ['Unknown'])[0] if result['openfda'].get('manufacturer_name') else 'Unknown'
                
                medicine = {
                    'generic_name': generic_name,
                    'brand_names': ', '.join(brand_names[:3]) if brand_names else 'Unknown',  # Limit to 3 brand names
                    'price': 0.0,  # FDA doesn't provide pricing
                    'description': description[:200] if description else 'No description available',  # Limit description length
                    'category': 'FDA Approved',
                    'dosage_form': 'Various',
                    'manufacturer': manufacturer
                }
                medicines.append(medicine)
        
        return medicines
        
    except Exception as e:
        print(f"Error downloading FDA data: {e}")
        return []

def download_who_essential_medicines():
    """
    Download WHO Essential Medicines List
    """
    print("Downloading WHO Essential Medicines data...")
    
    # WHO Essential Medicines List (this is a simplified version)
    # In practice, you would download from WHO's official sources
    who_medicines = [
        {
            'generic_name': 'Acetylsalicylic acid',
            'brand_names': 'Aspirin, Disprin',
            'price': 15.25,
            'description': 'Pain reliever and anti-inflammatory',
            'category': 'Essential Medicine',
            'dosage_form': 'Tablet',
            'manufacturer': 'Multiple'
        },
        {
            'generic_name': 'Amoxicillin',
            'brand_names': 'Amoxil, Moxatag',
            'price': 120.00,
            'description': 'Antibiotic for bacterial infections',
            'category': 'Essential Medicine',
            'dosage_form': 'Capsule',
            'manufacturer': 'Multiple'
        },
        {
            'generic_name': 'Metformin',
            'brand_names': 'Glucophage, Fortamet',
            'price': 35.25,
            'description': 'Diabetes medication',
            'category': 'Essential Medicine',
            'dosage_form': 'Tablet',
            'manufacturer': 'Multiple'
        }
    ]
    
    return who_medicines

def merge_medicine_databases():
    """
    Merge multiple medicine databases into one comprehensive dataset
    """
    print("Creating comprehensive medicine database...")
    
    # Load existing database
    existing_df = pd.read_csv("data/medicines.csv")
    print(f"Existing database has {len(existing_df)} medicines")
    
    # Download additional data
    fda_medicines = download_fda_drug_data()
    who_medicines = download_who_essential_medicines()
    
    # Convert to DataFrames
    fda_df = pd.DataFrame(fda_medicines)
    who_df = pd.DataFrame(who_medicines)
    
    # Merge all databases
    combined_df = pd.concat([existing_df, fda_df, who_df], ignore_index=True)
    
    # Remove duplicates based on generic name
    combined_df = combined_df.drop_duplicates(subset=['generic_name'], keep='first')
    
    # Sort by generic name
    combined_df = combined_df.sort_values('generic_name')
    
    # Save comprehensive database
    combined_df.to_csv("data/medicines_comprehensive.csv", index=False)
    
    print(f"Comprehensive database created with {len(combined_df)} unique medicines")
    print("Saved to: data/medicines_comprehensive.csv")
    
    return combined_df

def create_medicine_search_index():
    """
    Create a search index for faster medicine matching
    """
    print("Creating medicine search index...")
    
    df = pd.read_csv("data/medicines_comprehensive.csv")
    
    # Create search index
    search_index = {}
    
    for _, row in df.iterrows():
        generic_name = row['generic_name'].lower()
        brand_names = str(row['brand_names']).lower().split(', ')
        
        # Index generic name
        search_index[generic_name] = row.to_dict()
        
        # Index brand names
        for brand in brand_names:
            brand = brand.strip()
            if brand and brand != 'nan':
                search_index[brand] = row.to_dict()
    
    # Save search index
    with open("data/medicine_search_index.json", "w") as f:
        json.dump(search_index, f, indent=2)
    
    print(f"Search index created with {len(search_index)} entries")
    print("Saved to: data/medicine_search_index.json")

if __name__ == "__main__":
    print("=== Medicine Database Downloader ===")
    
    # Create comprehensive database
    comprehensive_df = merge_medicine_databases()
    
    # Create search index
    create_medicine_search_index()
    
    print("\n=== Summary ===")
    print(f"Total medicines: {len(comprehensive_df)}")
    print(f"Categories: {comprehensive_df['category'].nunique()}")
    print(f"Manufacturers: {comprehensive_df['manufacturer'].nunique()}")
    
    # Show sample data
    print("\n=== Sample Data ===")
    print(comprehensive_df.head(10).to_string())
    
    print("\n✅ Medicine database download complete!")
