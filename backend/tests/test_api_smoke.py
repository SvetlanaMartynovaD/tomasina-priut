from datetime import date

import pytest
from werkzeug.security import generate_password_hash

from backend.app import create_app, db
from backend.app.models import User, Animal, News


@pytest.fixture()
def app():
    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test',
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
    })
    with app.app_context():
        db.create_all()
        admin = User(username='Admin', email='admin@test.local', password_hash=generate_password_hash('secret123'), role='admin', is_confirmed=True)
        worker = User(username='Worker', email='worker@test.local', password_hash=generate_password_hash('secret123'), role='worker', is_confirmed=True)
        animal = Animal(name='Барсик', gender='мальчик', age_category='молодой', color='черный', arrival_date=date(2026, 1, 1), description='desc', status='ищет дом')
        news = News(title='Тест', content='Контент', type='новость')
        db.session.add_all([admin, worker, animal, news])
        db.session.commit()
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def test_login_me_logout_flow(client):
    r = client.post('/api/login', json={'email': 'admin@test.local', 'password': 'secret123'})
    assert r.status_code == 200
    assert r.json['ok'] is True

    me = client.get('/api/me')
    assert me.status_code == 200
    assert me.json['ok'] is True
    assert me.json['user']['role'] == 'admin'

    out = client.post('/api/logout', json={})
    assert out.status_code == 200
    assert out.json['ok'] is True


def test_animals_list(client):
    r = client.get('/api/animals?limit=10&offset=0')
    assert r.status_code == 200
    assert r.json['ok'] is True
    assert 'items' in r.json
    assert 'total' in r.json


def test_role_guard(client):
    r = client.get('/api/admin/stats')
    assert r.status_code == 401
