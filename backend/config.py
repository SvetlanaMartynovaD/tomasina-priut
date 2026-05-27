import os


class Config:
    # Секретный ключ будет браться из переменных окружения на хостинге
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
    
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://root:root@localhost:3306/u3483995_priut?charset=utf8mb4'
    )
    
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False

