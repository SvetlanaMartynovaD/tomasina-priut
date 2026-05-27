from pathlib import Path

from flask import Flask, abort, jsonify, send_from_directory
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
migrate = Migrate()


def create_app(test_config=None):
    app = Flask(__name__)
    try:
        app.config.from_object('config.Config')
    except Exception:
        app.config.from_object('backend.config.Config')

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    migrate.init_app(app, db, directory='backend/migrations')

    from .models import User, RegistrationRequest, Animal, AnimalRequest, News, NewsPhoto, Comment  # noqa: F401
    from .routes.api import api_bp
    from .cli import register_cli

    app.register_blueprint(api_bp, url_prefix='/api')
    register_cli(app)

    project_root = Path(__file__).resolve().parents[2]
    frontend_dir = project_root / 'frontend'

    @app.get('/')
    def site_root():
        return send_from_directory(project_root, 'index.html')

    @app.get('/index.html')
    def site_root_index():
        return send_from_directory(project_root, 'index.html')

    @app.get('/frontend/<path:filename>')
    def site_frontend(filename):
        file_path = frontend_dir / filename
        if not file_path.exists() or not file_path.is_file():
            abort(404)
        return send_from_directory(frontend_dir, filename)

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({'ok': False, 'message': 'Маршрут не найден'}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({'ok': False, 'message': 'Внутренняя ошибка сервера'}), 500

    return app
