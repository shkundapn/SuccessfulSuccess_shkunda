import os
import sys
import json
import subprocess
from pathlib import Path

# Load environment variables from .env
env_file = Path(__file__).resolve().parent.parent / '.env'
env = os.environ.copy()

if env_file.exists():
    with open(env_file, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()

env['AWS_DEFAULT_REGION'] = env.get('AWS_REGION', 'us-east-1')
db_id = env.get('PROJECT_NAME', 'spry-shkunda') + '-db'

action = sys.argv[1].lower() if len(sys.argv) > 1 else 'status'

if action == 'status':
    cmd = f'aws rds describe-db-instances --db-instance-identifier {db_id}'
    res = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
    if res.returncode == 0:
        data = json.loads(res.stdout)
        inst = data['DBInstances'][0]
        print(f"Database: {db_id}")
        print(f"Status:   {inst['DBInstanceStatus']}")
        print(f"Class:    {inst['DBInstanceClass']}")
        print(f"Engine:   {inst['Engine']} {inst['EngineVersion']}")
        print(f"Storage:  {inst['AllocatedStorage']} GB {inst['StorageType']}")
    else:
        print("Error describing database:", res.stderr.strip())

elif action == 'stop':
    print(f"Stopping RDS instance '{db_id}'...")
    cmd = f'aws rds stop-db-instance --db-instance-identifier {db_id}'
    res = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
    if res.returncode == 0:
        print("Success! Status is now transitioning to 'stopping'. Hourly compute billing halted.")
    else:
        print("Error stopping database:", res.stderr.strip())

elif action == 'start':
    print(f"Starting RDS instance '{db_id}' (takes ~90 seconds)...")
    cmd = f'aws rds start-db-instance --db-instance-identifier {db_id}'
    res = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
    if res.returncode == 0:
        print("Success! Database is starting up. Run 'python scripts/rds.py status' to monitor.")
    elif "InsufficientDBInstanceCapacity" in res.stderr:
        print("Warning: Insufficient capacity for current class. Trying fallback class db.t3.micro...")
        subprocess.run(f'aws rds modify-db-instance --db-instance-identifier {db_id} --db-instance-class db.t3.micro --apply-immediately', shell=True, env=env, capture_output=True)
        res_retry = subprocess.run(f'aws rds start-db-instance --db-instance-identifier {db_id}', shell=True, env=env, capture_output=True, text=True)
        if res_retry.returncode == 0:
            print("Success! Switched to db.t3.micro and database is starting up.")
        else:
            print("Error starting database:", res_retry.stderr.strip())
    else:
        print("Error starting database:", res.stderr.strip())

else:
    print(f"Unknown command '{action}'. Usage: python scripts/rds.py [status|stop|start]")
