"""
Vercel Serverless Function entrypoint for 5G Slice Advisor API.
Routes all /api/* requests to the FastAPI application.
"""

import sys
from pathlib import Path

# Ensure backend directory is in Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.main import app

# Vercel looks for 'app' or 'handler'
handler = app
