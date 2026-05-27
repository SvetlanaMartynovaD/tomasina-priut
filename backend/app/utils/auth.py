from functools import wraps

from flask import jsonify, session

from ..models import User


def get_current_user():
    #получение тикущего пользователя
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)


def login_required(fn):
    #защищает маршруты, доступные только авторизованным пользователям
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'ok': False, 'message': 'Требуется авторизация'}), 401
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    #защищает маршруты, доступные только пользователям с определёнными ролям
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'ok': False, 'message': 'Требуется авторизация'}), 401
            if user.role not in roles:
                return jsonify({'ok': False, 'message': 'Недостаточно прав'}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
