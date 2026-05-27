from . import db
from sqlalchemy import func


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    password_hash = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.Enum('worker', 'admin', name='users_role'), nullable=False, default='worker')
    is_confirmed = db.Column(db.Boolean, nullable=False, default=False)
    registered_at = db.Column(db.DateTime, nullable=False, server_default=func.current_timestamp())


class RegistrationRequest(db.Model):
    __tablename__ = 'registration_requests'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    additional_info = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.current_timestamp())
    status = db.Column(db.Enum('ожидает', 'одобрена', 'отклонена', name='registration_status'), nullable=False, default='ожидает')


class Animal(db.Model):
    __tablename__ = 'animals'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.Enum('мальчик', 'девочка', name='animal_gender'), nullable=False)
    age_category = db.Column(db.Enum('котенок', 'молодой', 'взрослый', 'пожилой', name='animal_age_category'), nullable=False)
    color = db.Column(db.String(50), nullable=False)
    arrival_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text, nullable=False)
    photo_url = db.Column(db.String(500))
    status = db.Column(db.Enum('ищет дом', 'на передержке', 'пристроен', 'выбыло', name='animal_status'), nullable=False, default='ищет дом')


class AnimalRequest(db.Model):
    __tablename__ = 'animal_requests'

    id = db.Column(db.Integer, primary_key=True)
    animal_id = db.Column(db.Integer, db.ForeignKey('animals.id'), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    living_conditions = db.Column(db.Text, nullable=False)
    experience = db.Column(db.Text)
    additional_comments = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.current_timestamp())
    status = db.Column(db.Enum('новая', 'в обработке', 'одобрена', 'отклонена', 'закрыта', name='animal_request_status'), nullable=False, default='новая')

    animal = db.relationship('Animal')


class News(db.Model):
    __tablename__ = 'news'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.current_timestamp())
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    type = db.Column(db.Enum('новость', 'мероприятие', name='news_type'), nullable=False)
    event_date = db.Column(db.Date)
    event_place = db.Column(db.String(255))

    author = db.relationship('User')
    photos = db.relationship('NewsPhoto', order_by='NewsPhoto.sort_order.asc()', cascade='all, delete-orphan')


class NewsPhoto(db.Model):
    __tablename__ = 'news_photos'

    id = db.Column(db.Integer, primary_key=True)
    news_id = db.Column(db.Integer, db.ForeignKey('news.id'), nullable=False)
    photo_url = db.Column(db.String(500), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)


class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    news_id = db.Column(db.Integer, db.ForeignKey('news.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    guest_name = db.Column(db.String(100))
    guest_email = db.Column(db.String(100))
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.current_timestamp())

    user = db.relationship('User')
