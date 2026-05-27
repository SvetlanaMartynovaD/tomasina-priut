import sys
sys.path.insert(0, '/app/backend')

from app import create_app

app = create_app()