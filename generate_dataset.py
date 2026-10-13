import csv
import random
from datetime import datetime, timedelta

def generate_cloud_data(num_days=90):
    start_date = datetime.now() - timedelta(days=num_days)
    
    providers = ['AWS', 'GCP', 'Azure']
    services = {
        'AWS': ['EC2', 'RDS', 'S3', 'Lambda', 'EKS'],
        'GCP': ['Compute Engine', 'Cloud SQL', 'Cloud Storage', 'Cloud Functions', 'GKE'],
        'Azure': ['Virtual Machines', 'Azure SQL', 'Blob Storage', 'Azure Functions', 'AKS']
    }
    
    microservices = [f'ms-{i}' for i in range(1, 11)]
    regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
    
    data = []
    
    print(f"Generating data for {num_days} days...")
    
    for day in range(num_days * 24): # Hourly data
        current_time = start_date + timedelta(hours=day)
        
        # Seasonality: higher traffic during day time (8 AM to 8 PM)
        hour = current_time.hour
        traffic_multiplier = 1.5 if 8 <= hour <= 20 else 0.5
        
        # Weekly seasonality: lower on weekends
        day_of_week = current_time.weekday()
        if day_of_week >= 5: # Weekend
            traffic_multiplier *= 0.6
            
        for _ in range(random.randint(10, 20)):
            provider = random.choice(providers)
            service = random.choice(services[provider])
            microservice = random.choice(microservices)
            region = random.choice(regions)
            
            # Base metrics
            base_cpu = random.uniform(10, 40)
            base_ram = random.uniform(20, 50)
            
            # Apply seasonality
            cpu_usage = min(100.0, base_cpu * traffic_multiplier * random.uniform(0.8, 1.2))
            ram_usage = min(100.0, base_ram * traffic_multiplier * random.uniform(0.9, 1.1))
            
            network_in = random.uniform(1000, 10000) * traffic_multiplier
            network_out = random.uniform(2000, 20000) * traffic_multiplier
            
            # Base cost depends on service and usage
            base_cost = (cpu_usage * 0.05) + (ram_usage * 0.02) + (network_out / 1000 * 0.01)
            
            # Inject anomalies (approx 2% chance)
            is_anomaly = random.random() < 0.02
            if is_anomaly:
                anomaly_type = random.choice(['spike', 'leak', 'zombie'])
                if anomaly_type == 'spike':
                    cpu_usage = min(100.0, cpu_usage * random.uniform(2.5, 4.0))
                    base_cost *= random.uniform(3.0, 5.0)
                elif anomaly_type == 'leak':
                    ram_usage = min(100.0, ram_usage * random.uniform(1.8, 2.5))
                    base_cost *= random.uniform(1.5, 2.5)
                elif anomaly_type == 'zombie':
                    cpu_usage = random.uniform(1, 5)
                    ram_usage = random.uniform(1, 5)
                    base_cost *= random.uniform(1.5, 2.0)
            
            # Simulate missing values for data cleaning tasks (approx 5% missing for CPU, 3% for RAM)
            cpu_val = round(cpu_usage, 2) if random.random() > 0.05 else ''
            ram_val = round(ram_usage, 2) if random.random() > 0.03 else ''
                    
            data.append({
                'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                'cloud_provider': provider,
                'service_name': service,
                'microservice_id': microservice,
                'region': region,
                'cpu_usage_percent': cpu_val,
                'ram_usage_percent': ram_val,
                'network_in_bytes': int(network_in),
                'network_out_bytes': int(network_out),
                'cost_usd': round(base_cost, 4),
                'is_anomaly': int(is_anomaly)
            })
            
    output_file = 'cloud_cost_dataset.csv'
    keys = data[0].keys()
    
    with open(output_file, 'w', newline='') as output_file_handle:
        dict_writer = csv.DictWriter(output_file_handle, keys)
        dict_writer.writeheader()
        dict_writer.writerows(data)
        
    print(f"Dataset generated successfully: {output_file} ({len(data)} rows)")

if __name__ == "__main__":
    generate_cloud_data()
