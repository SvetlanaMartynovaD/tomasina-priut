import click
from werkzeug.security import generate_password_hash

from . import db
from .models import User


def register_cli(app):
    #добавляет пользовательские команды в интерфейс flask
    @app.cli.command('seed-admin')
    @click.option('--username', required=True)
    @click.option('--email', required=True)
    @click.option('--password', required=True)
    @click.option('--phone', default='')
    def seed_admin(username, email, password, phone):
        #создаёт нового администратора или обновляет существующего
        user = User.query.filter_by(email=email).first()
        if user:
            user.username = username
            user.phone = phone or user.phone
            user.password_hash = generate_password_hash(password)
            user.role = 'admin'
            user.is_confirmed = True
            click.echo('Admin user updated.')
        else:
            user = User(
                username=username,
                email=email,
                phone=phone or None,
                password_hash=generate_password_hash(password),
                role='admin',
                is_confirmed=True,
            )
            db.session.add(user)
            click.echo('Admin user created.')

        db.session.commit()

