"""
Import High School Football Combine Data
Processes the CSV file and converts it to our app's format
"""

import csv
import json
import re
from typing import Dict, List, Optional

def parse_height_to_inches(height_str: str) -> Optional[float]:
    """
    Convert height from formats like "6' 0", "5' 11", '6'2"' to total inches
    """
    if not height_str or str(height_str).strip() == '':
        return None
    
    # Clean up the string
    height_str = str(height_str).strip()
    
    # Handle format like "6' 0" or "5' 11"
    match = re.match(r"(\d+)'?\s*(\d+)", height_str)
    if match:
        feet = int(match.group(1))
        inches = int(match.group(2))
        return feet * 12 + inches
    
    # Handle format like "6'" (no inches specified)
    match = re.match(r"(\d+)'", height_str)
    if match:
        feet = int(match.group(1))
        return feet * 12
    
    return None

def clean_numeric_value(value) -> Optional[float]:
    """Convert string to float, handling empty/invalid values"""
    if value is None or str(value).strip() == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def process_combine_data(csv_path: str, output_json_path: str):
    """
    Read the CSV, clean it, and export to JSON for the app
    """
    athletes = []
    stats = {
        'total_athletes': 0,
        'with_40_time': 0,
        'with_vertical': 0,
        'with_broad_jump': 0,
        'positions': {},
        'states': {},
        'grad_years': {}
    }
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            # Parse height
            height_inches = parse_height_to_inches(row.get('height', ''))
            
            # Clean numeric values
            weight = clean_numeric_value(row.get('weight'))
            dash40 = clean_numeric_value(row.get('forty_yard_dash'))
            vertical_jump = clean_numeric_value(row.get('vertical_jump'))
            broad_jump = clean_numeric_value(row.get('broad_jump'))
            pro_agility = clean_numeric_value(row.get('shuttle_run'))
            l_drill = clean_numeric_value(row.get('three_cone'))
            
            # Create athlete object
            athlete = {
                'id': len(athletes) + 1,
                'firstName': row.get('first_name', '').strip(),
                'lastName': row.get('last_name', '').strip(),
                'position': row.get('position', '').strip(),
                'state': row.get('state', '').strip(),
                'gradYear': clean_numeric_value(row.get('grad_year')),
                
                # Metrics our app uses
                'height': height_inches,
                'weight': weight,
                'dash40': dash40,
                'verticalJump': vertical_jump,
                'broadJump': broad_jump,
                'proAgility': pro_agility,
                'lDrill': l_drill,
                
                # Additional context
                'conditions': row.get('conditions', '').strip()
            }
            
            # Only include athletes with at least some data
            if any([dash40, vertical_jump, broad_jump, height_inches, weight]):
                athletes.append(athlete)
                
                # Update stats
                stats['total_athletes'] += 1
                if dash40:
                    stats['with_40_time'] += 1
                if vertical_jump:
                    stats['with_vertical'] += 1
                if broad_jump:
                    stats['with_broad_jump'] += 1
                
                # Track positions
                pos = athlete['position']
                stats['positions'][pos] = stats['positions'].get(pos, 0) + 1
                
                # Track states
                state = athlete['state']
                if state:
                    stats['states'][state] = stats['states'].get(state, 0) + 1
                
                # Track grad years
                year = athlete['gradYear']
                if year:
                    stats['grad_years'][str(int(year))] = stats['grad_years'].get(str(int(year)), 0) + 1
    
    # Calculate some basic statistics for each metric
    metric_stats = calculate_metric_statistics(athletes)
    
    # Prepare output
    output = {
        'athletes': athletes,
        'summary': stats,
        'metricStatistics': metric_stats,
        'dataSource': 'Kaggle - High School Football Combine Dataset',
        'totalRecords': len(athletes)
    }
    
    # Write to JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Successfully processed {len(athletes)} athletes")
    print(f"📊 Output saved to: {output_json_path}")
    print(f"\nQuick Stats:")
    print(f"  - Athletes with 40-yard dash: {stats['with_40_time']}")
    print(f"  - Athletes with vertical jump: {stats['with_vertical']}")
    print(f"  - Athletes with broad jump: {stats['with_broad_jump']}")
    print(f"  - Unique positions: {len(stats['positions'])}")
    print(f"  - States represented: {len(stats['states'])}")
    print(f"\nTop 5 Positions:")
    for pos, count in sorted(stats['positions'].items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  - {pos}: {count} athletes")
    
    return output

def calculate_metric_statistics(athletes: List[Dict]) -> Dict:
    """Calculate mean, std, min, max for each metric"""
    from statistics import mean, stdev
    
    metrics = ['dash40', 'verticalJump', 'broadJump', 'proAgility', 'lDrill', 'height', 'weight']
    stats = {}
    
    for metric in metrics:
        values = [a[metric] for a in athletes if a.get(metric) is not None]
        
        if len(values) > 1:
            stats[metric] = {
                'mean': round(mean(values), 2),
                'std': round(stdev(values), 2),
                'min': round(min(values), 2),
                'max': round(max(values), 2),
                'count': len(values)
            }
        else:
            stats[metric] = {
                'mean': None,
                'std': None,
                'min': None,
                'max': None,
                'count': len(values)
            }
    
    return stats

if __name__ == '__main__':
    import os
    
    # Determine paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '../database/seeds/football_combine_data_combined.csv')
    output_path = os.path.join(script_dir, '../database/seeds/athletes_data.json')
    
    print("🏈 Processing High School Football Combine Data...")
    print(f"📁 Input: {csv_path}")
    print(f"📁 Output: {output_path}")
    
    result = process_combine_data(csv_path, output_path)
    
    print("\n✨ Done! Your data is ready to use in the app.")
