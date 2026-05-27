"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa


revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'animals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('gender', sa.Enum('мальчик', 'девочка', name='animal_gender'), nullable=False),
        sa.Column('age_category', sa.Enum('котенок', 'молодой', 'взрослый', 'пожилой', name='animal_age_category'), nullable=False),
        sa.Column('color', sa.String(length=50), nullable=False),
        sa.Column('arrival_date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('photo_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.Enum('ищет дом', 'на передержке', 'пристроен', 'выбыло', name='animal_status'), nullable=False, server_default='ищет дом'),
    )

    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('role', sa.Enum('worker', 'admin', name='users_role'), nullable=False, server_default='worker'),
        sa.Column('is_confirmed', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('registered_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    op.create_table(
        'registration_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('additional_info', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('status', sa.Enum('ожидает', 'одобрена', 'отклонена', name='registration_status'), nullable=False, server_default='ожидает'),
    )

    op.create_table(
        'news',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('type', sa.Enum('новость', 'мероприятие', name='news_type'), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('event_place', sa.String(length=255), nullable=True),
    )

    op.create_table(
        'animal_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('animal_id', sa.Integer(), sa.ForeignKey('animals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('living_conditions', sa.Text(), nullable=False),
        sa.Column('experience', sa.Text(), nullable=True),
        sa.Column('additional_comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('status', sa.Enum('новая', 'в обработке', 'одобрена', 'отклонена', 'закрыта', name='animal_request_status'), nullable=False, server_default='новая'),
    )

    op.create_table(
        'news_photos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('news_id', sa.Integer(), sa.ForeignKey('news.id', ondelete='CASCADE'), nullable=False),
        sa.Column('photo_url', sa.String(length=500), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
    )

    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('news_id', sa.Integer(), sa.ForeignKey('news.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('guest_name', sa.String(length=100), nullable=True),
        sa.Column('guest_email', sa.String(length=100), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )


def downgrade():
    op.drop_table('comments')
    op.drop_table('news_photos')
    op.drop_table('animal_requests')
    op.drop_table('news')
    op.drop_table('registration_requests')
    op.drop_table('users')
    op.drop_table('animals')
