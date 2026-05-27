from datetime import datetime

from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash

from .. import db
from ..models import Animal, AnimalRequest, Comment, News, NewsPhoto, RegistrationRequest, User
from ..services.common import json_payload, normalize
from ..utils.auth import get_current_user, role_required
from ..utils.passwords import verify_password
from ..utils.serializers import animal_to_dict, dt_to_str, news_to_card_dict, news_to_detail_dict

api_bp = Blueprint('api', __name__)
#список допустимых статусов заявок
ANIMAL_REQUEST_STATUSES = {'новая', 'в обработке', 'одобрена', 'отклонена', 'закрыта'}

#Обновление статуса питомца в зависимости от статуса заявки
def _apply_animal_request_status(req: AnimalRequest, status: str):
    prev_status = req.status
    req.status = status

    if req.animal:
        if status == 'одобрена':
            req.animal.status = 'пристроен'
        elif prev_status == 'одобрена' and status != 'одобрена':
            req.animal.status = 'ищет дом'


# Авторизация и аутентификация
# ============================================================================================
@api_bp.get('/me') 
def me():
    # возвращает данные текущего авторизованного пользователя
    user = get_current_user()
    if not user:
        return jsonify({'ok': False, 'message': 'Не авторизован'}), 401
    return jsonify({'ok': True, 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'phone': user.phone, 'role': user.role}})


@api_bp.post('/login')
def login():
    #вход пользователя в систему
    payload = json_payload()
    email = normalize(payload.get('email')).lower()
    password = payload.get('password') or ''

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or not verify_password(user.password_hash, password):
        return jsonify({'ok': False, 'message': 'Неверный email или пароль'}), 400
    if not user.is_confirmed:
        return jsonify({'ok': False, 'message': 'Пользователь не подтвержден'}), 403

    session['user_id'] = user.id
    return jsonify({'ok': True, 'message': 'Вход выполнен', 'user': {'id': user.id, 'role': user.role}})


@api_bp.post('/logout')
def logout():
    #выход из системы
    session.clear()
    return jsonify({'ok': True, 'message': 'Выход выполнен'})


@api_bp.post('/register-request')
def register_request():
    #подача заявки на регистрацию
    payload = json_payload()
    first_name = normalize(payload.get('first_name'))
    last_name = normalize(payload.get('last_name'))
    phone = normalize(payload.get('phone'))
    email = normalize(payload.get('email')).lower()
    password = payload.get('password') or ''
    about = normalize(payload.get('about'))

    if not all([first_name, last_name, phone, email, password]):
        return jsonify({'ok': False, 'message': 'Заполните обязательные поля'}), 400
    if len(password) < 6:
        return jsonify({'ok': False, 'message': 'Пароль слишком короткий'}), 400

    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'ok': False, 'message': 'Пользователь уже зарегистрирован'}), 409

    exists_request = RegistrationRequest.query.filter(db.func.lower(RegistrationRequest.email) == email, RegistrationRequest.status == 'ожидает').first()
    if exists_request:
        return jsonify({'ok': False, 'message': 'Заявка уже отправлена и ожидает рассмотрения'}), 409

    req = RegistrationRequest(username=f'{first_name} {last_name}'.strip(), email=email, phone=phone, password_hash=generate_password_hash(password), additional_info=about, status='ожидает')
    db.session.add(req)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Заявка отправлена'})


# Работа с анкетами на питомцев их каталогом
# ============================================================================================
@api_bp.get('/animals/colors')
def animal_colors():
    #список уникальных окрасов питомцев для фильтра
    rows = db.session.query(Animal.color).distinct().order_by(Animal.color.asc()).all()
    return jsonify({'ok': True, 'items': [r[0] for r in rows]})


@api_bp.get('/animals')
def animals():
    #Получения списка питомцев в зависимости от фильтров и прав пользователя

    limit = max(1, min(int(request.args.get('limit', 12)), 100))
    offset = max(0, int(request.args.get('offset', 0)))

    q = Animal.query
    user = get_current_user()
    is_staff = bool(user and user.role in ('admin', 'worker'))

    #фильтры
    genders = request.args.getlist('gender')
    ages = request.args.getlist('age')
    statuses = request.args.getlist('status')
    colors = request.args.getlist('color')

    if genders:
        q = q.filter(Animal.gender.in_(genders))
    if ages:
        q = q.filter(Animal.age_category.in_(ages))
    if statuses:
        q = q.filter(Animal.status.in_(statuses))
    elif not is_staff:
        q = q.filter(Animal.status == 'ищет дом')
    if colors:
        q = q.filter(Animal.color.in_(colors))
    #сортировка сначало новые потом по порядку
    total = q.count()
    items = q.order_by(Animal.id.desc()).offset(offset).limit(limit).all()
    return jsonify({'ok': True, 'total': total, 'items': [animal_to_dict(i) for i in items]})


@api_bp.get('/animal')
def animal_detail():
    #возвращает детальную информацию об одном питомце по его id
    animal_id = request.args.get('id', type=int)
    if not animal_id:
        return jsonify({'ok': False, 'message': 'Питомец не выбран'}), 400

    animal = Animal.query.get(animal_id)
    if not animal:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404

    return jsonify({'ok': True, 'animal': animal_to_dict(animal)})




# Заявки на питомцев
# ============================================================================================

@api_bp.get('/pet-request-form-meta')
def pet_request_form_meta():
    # получение клички питомца для заявки
    animal_id = request.args.get('animal_id', type=int)
    if not animal_id:
        return jsonify({'ok': False, 'message': 'Не указан animal_id'}), 400
    animal = Animal.query.get(animal_id)
    if not animal:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404
    return jsonify({'ok': True, 'pet_name': animal.name})


@api_bp.post('/pet-request')
def pet_request_create():
    # сохранение заявки на питомца
    payload = json_payload()
    animal_id = int(payload.get('animal_id') or 0)
    first_name = normalize(payload.get('first_name'))
    last_name = normalize(payload.get('last_name'))
    patronymic = normalize(payload.get('patronymic'))
    phone = normalize(payload.get('phone'))
    email = normalize(payload.get('email')).lower()
    living_conditions = normalize(payload.get('living_conditions'))
    experience = normalize(payload.get('experience'))
    about = normalize(payload.get('about'))

    if not all([animal_id, first_name, last_name, phone, email, living_conditions]):
        return jsonify({'ok': False, 'message': 'Заполните обязательные поля'}), 400

    animal = Animal.query.get(animal_id)
    if not animal:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404

    full_name = ' '.join([x for x in [last_name, first_name, patronymic] if x])
    req = AnimalRequest(animal_id=animal_id, full_name=full_name, phone=phone, email=email, living_conditions=living_conditions, experience=experience or None, additional_comments=about or None, status='новая')
    db.session.add(req)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Заявка отправлена', 'id': req.id})



# Работа с новостями и комментариями
# ============================================================================================

@api_bp.get('/news')
def news_list():
    # получение списка новостей с фи
    limit = max(1, min(int(request.args.get('limit', 10)), 100))
    offset = max(0, int(request.args.get('offset', 0)))
    # сортировка сначала новые
    q = News.query.order_by(News.created_at.desc(), News.id.desc())
    total = q.count()
    items = q.offset(offset).limit(limit).all()
    return jsonify({'ok': True, 'total': total, 'items': [news_to_card_dict(n) for n in items]})


@api_bp.get('/news/<int:news_id>')
def news_detail(news_id):
    # получение детальной информация об одной новости
    n = News.query.get(news_id)
    if not n:
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404
    return jsonify({'ok': True, 'news': news_to_detail_dict(n)})


@api_bp.get('/news/<int:news_id>/comments')
def news_comments(news_id):
    # Получение всех коментариев к новости
    if not News.query.get(news_id):
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404

    items = Comment.query.filter_by(news_id=news_id).order_by(Comment.created_at.desc(), Comment.id.desc()).all()
    out = []
    for c in items:
        out.append({'id': c.id, 'name': c.user.username if c.user else (c.guest_name or 'Гость'), 'email': c.user.email if c.user else c.guest_email, 'content': c.content, 'created_at': dt_to_str(c.created_at)})
    return jsonify({'ok': True, 'items': out})


@api_bp.post('/news/<int:news_id>/comments')
def create_news_comment(news_id):
    # Добавление нового коментария к новости
    if not News.query.get(news_id):
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404

    payload = json_payload()
    name = normalize(payload.get('name'))
    email = normalize(payload.get('email'))
    content = normalize(payload.get('content'))
    if not all([name, email, content]):
        return jsonify({'ok': False, 'message': 'Заполните имя, email и текст комментария'}), 400
    
    # для авторизованных
    user = get_current_user()
    c = Comment(news_id=news_id, user_id=user.id if user else None, guest_name=None if user else name, guest_email=None if user else email, content=content)
    db.session.add(c)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Комментарий добавлен', 'id': c.id})



# Редактирование новостей для зарегистированных
# ============================================================================================

@api_bp.get('/admin/news/<int:news_id>')
@role_required('admin', 'worker')
def admin_news_detail(news_id):
    # получение новости для редактирования
    n = News.query.get(news_id)
    if not n:
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404
    return jsonify({'ok': True, 'news': news_to_detail_dict(n)})


@api_bp.post('/admin/news')
@role_required('admin', 'worker')
def admin_news_create():
    # создание новой новости
    user = get_current_user()
    payload = json_payload()
    title = normalize(payload.get('title'))
    content = normalize(payload.get('content'))
    ntype = normalize(payload.get('type')) or 'новость'
    event_date = normalize(payload.get('event_date'))
    event_place = normalize(payload.get('event_place'))
    cover_photo = normalize(payload.get('cover_photo'))
    photos = payload.get('photos') or []

    if not title or not content:
        return jsonify({'ok': False, 'message': 'Заполните обязательные поля'}), 400

    n = News(title=title, content=content, type=ntype if ntype in ('новость', 'мероприятие') else 'новость', event_date=datetime.strptime(event_date, '%Y-%m-%d').date() if event_date else None, event_place=event_place or None, author_id=user.id if user else None)
    db.session.add(n)
    db.session.flush()

    all_photos = []
    if cover_photo:
        all_photos.append(cover_photo)
    if isinstance(photos, list):
        all_photos.extend([normalize(p) for p in photos if normalize(p)])

    for idx, url in enumerate(all_photos):
        db.session.add(NewsPhoto(news_id=n.id, photo_url=url, sort_order=idx))

    db.session.commit()
    return jsonify({'ok': True, 'message': 'Новость добавлена', 'id': n.id})


@api_bp.post('/admin/news/<int:news_id>')
@role_required('admin', 'worker')
def admin_news_update(news_id):
    # Обновление существуещей новости
    n = News.query.get(news_id)
    if not n:
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404

    payload = json_payload()
    n.title = normalize(payload.get('title')) or n.title
    n.content = normalize(payload.get('content')) or n.content
    ntype = normalize(payload.get('type'))
    if ntype in ('новость', 'мероприятие'):
        n.type = ntype

    event_date = normalize(payload.get('event_date'))
    n.event_date = datetime.strptime(event_date, '%Y-%m-%d').date() if event_date else None
    n.event_place = normalize(payload.get('event_place')) or None

    NewsPhoto.query.filter_by(news_id=n.id).delete()
    cover_photo = normalize(payload.get('cover_photo'))
    photos = payload.get('photos') or []
    all_photos = []
    if cover_photo:
        all_photos.append(cover_photo)
    if isinstance(photos, list):
        all_photos.extend([normalize(p) for p in photos if normalize(p)])
    for idx, url in enumerate(all_photos):
        db.session.add(NewsPhoto(news_id=n.id, photo_url=url, sort_order=idx))

    db.session.commit()
    return jsonify({'ok': True, 'message': 'Новость обновлена', 'id': n.id})


@api_bp.post('/admin/news/<int:news_id>/delete')
@role_required('admin')
def admin_news_delete(news_id):
    # Удаление новости для админа
    n = News.query.get(news_id)
    if not n:
        return jsonify({'ok': False, 'message': 'Новость не найдена'}), 404
    db.session.delete(n)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Новость удалена'})


@api_bp.post('/admin/comments/<int:comment_id>/delete')
@role_required('admin')
def admin_comment_delete(comment_id):
    # удаление коментария к новости
    c = Comment.query.get(comment_id)
    if not c:
        return jsonify({'ok': False, 'message': 'Комментарий не найден'}), 404
    db.session.delete(c)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Комментарий удален'})




# Редактирование питомцев для зарегистированных
# ============================================================================================

@api_bp.post('/admin/animals')
@role_required('admin', 'worker')
def admin_animal_create():
    # добавление нового питомца
    payload = json_payload()
    try:
        arrival_date = datetime.strptime(normalize(payload.get('arrival_date')), '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'ok': False, 'message': 'Некорректная дата'}), 400

    a = Animal(name=normalize(payload.get('name')), gender=normalize(payload.get('gender')), age_category=normalize(payload.get('age_category')), color=normalize(payload.get('color')), arrival_date=arrival_date, description=normalize(payload.get('description')), photo_url=normalize(payload.get('photo_url')) or None, status=normalize(payload.get('status')) or 'ищет дом')
    db.session.add(a)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Питомец добавлен успешно', 'id': a.id})

@api_bp.post('/admin/animals/<int:animal_id>')
@role_required('admin', 'worker')
def admin_animal_update(animal_id):
    # обновление информации о питомце
    a = Animal.query.get(animal_id)
    if not a:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404
    payload = json_payload()

    for field in ['name', 'gender', 'age_category', 'color', 'description', 'photo_url', 'status']:
        if field in payload:
            setattr(a, field, normalize(payload.get(field)) or getattr(a, field))

    if 'arrival_date' in payload and normalize(payload.get('arrival_date')):
        try:
            a.arrival_date = datetime.strptime(normalize(payload.get('arrival_date')), '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'ok': False, 'message': 'Некорректная дата'}), 400

    db.session.commit()
    return jsonify({'ok': True, 'message': 'Питомец обновлен успешно', 'id': a.id})


@api_bp.post('/admin/animals/<int:animal_id>/status')
@role_required('admin', 'worker')
def admin_animal_status(animal_id):
    # изменение статуса питомца 
    a = Animal.query.get(animal_id)
    if not a:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404
    status = normalize(json_payload().get('status'))
    if not status:
        return jsonify({'ok': False, 'message': 'Статус не указан'}), 400
    a.status = status
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Статус обновлен', 'status': a.status})


@api_bp.post('/admin/animals/<int:animal_id>/delete')
@role_required('admin')
def admin_animal_delete(animal_id):
    # удаление питомца админом
    a = Animal.query.get(animal_id)
    if not a:
        return jsonify({'ok': False, 'message': 'Питомец не найден'}), 404
    db.session.delete(a)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Питомец удален'})





# Работа с заявками на питомцев для админа
# ============================================================================================

@api_bp.get('/admin/animal-requests')
@role_required('admin')
def admin_animal_requests():
    # получение всех заявок
    items = AnimalRequest.query.order_by(AnimalRequest.created_at.desc(), AnimalRequest.id.desc()).all()
    return jsonify({'ok': True, 'requests': [_request_to_dict(i) for i in items]})


@api_bp.get('/admin/animal-requests/<int:request_id>')
@role_required('admin')
def admin_animal_request_detail(request_id):
    # получение дитальной информации по заявки
    req = AnimalRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    return jsonify({'ok': True, 'request': _request_to_dict(req)})


@api_bp.post('/admin/animal-requests/<int:request_id>/status')
@role_required('admin')
def admin_animal_request_status(request_id):
    # изменение статуса заяки
    req = AnimalRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    status = normalize(json_payload().get('status'))
    if not status:
        return jsonify({'ok': False, 'message': 'Статус не указан'}), 400
    if status not in ANIMAL_REQUEST_STATUSES:
        return jsonify({'ok': False, 'message': 'Некорректный статус заявки'}), 400
    _apply_animal_request_status(req, status)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Статус обновлен', 'status': req.status, 'animal_status': req.animal.status if req.animal else None})


@api_bp.post('/admin/animal-requests/<int:request_id>/delete')
@role_required('admin')
def admin_animal_request_delete(request_id):
    # удаление некоректной заявки
    req = AnimalRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    db.session.delete(req)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Заявка удалена'})



# Работа с заявками на питомцев для админа
# ============================================================================================

@api_bp.get('/admin/registration-requests')
@role_required('admin')
def admin_registration_requests():
    # получение всех заявок на регистрацию
    items = RegistrationRequest.query.order_by(RegistrationRequest.created_at.desc(), RegistrationRequest.id.desc()).all()
    return jsonify({'ok': True, 'requests': [{'id': i.id, 'username': i.username, 'email': i.email, 'phone': i.phone, 'additional_info': i.additional_info, 'status': i.status, 'created_at': dt_to_str(i.created_at)} for i in items]})


@api_bp.post('/admin/registration-requests/<int:request_id>/approve')
@role_required('admin')
def admin_registration_approve(request_id):
    # одобрение заявки на регистрацию
    req = RegistrationRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404

    if User.query.filter(db.func.lower(User.email) == req.email.lower()).first():
        req.status = 'одобрена'
        db.session.commit()
        return jsonify({'ok': True, 'message': 'Пользователь уже существует. Заявка помечена как одобренная.'})
    # создание нового пользователя
    user = User(username=req.username, email=req.email, phone=req.phone, password_hash=req.password_hash, role='worker', is_confirmed=True)
    req.status = 'одобрена'
    db.session.add(user)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Заявка одобрена'})


@api_bp.post('/admin/registration-requests/<int:request_id>/reject')
@role_required('admin')
def admin_registration_reject(request_id):
    # отклонение заявки на регистрацию
    req = RegistrationRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    req.status = 'отклонена'
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Заявка отклонена'})




# Работа с заявками на питомцев для работников
# ============================================================================================

@api_bp.get('/worker/animal-requests')
@role_required('worker')
def worker_animal_requests():
    # получение всех заявок
    items = AnimalRequest.query.order_by(AnimalRequest.created_at.desc(), AnimalRequest.id.desc()).all()
    return jsonify({'ok': True, 'requests': [_request_to_dict(i) for i in items]})


@api_bp.get('/worker/animal-requests/<int:request_id>')
@role_required('worker')
def worker_animal_request_detail(request_id):
    # получение дитальной информации по заяке
    req = AnimalRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    return jsonify({'ok': True, 'request': _request_to_dict(req)})


@api_bp.post('/worker/animal-requests/<int:request_id>/status')
@role_required('worker')
def worker_animal_request_status(request_id):
    # изменение статуса заявки 
    req = AnimalRequest.query.get(request_id)
    if not req:
        return jsonify({'ok': False, 'message': 'Заявка не найдена'}), 404
    status = normalize(json_payload().get('status'))
    if not status:
        return jsonify({'ok': False, 'message': 'Статус не указан'}), 400
    if status not in ANIMAL_REQUEST_STATUSES:
        return jsonify({'ok': False, 'message': 'Некорректный статус заявки'}), 400
    _apply_animal_request_status(req, status)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Статус обновлен', 'status': req.status, 'animal_status': req.animal.status if req.animal else None})





# Обработка станицы Статистика для админа
# ============================================================================================

@api_bp.get('/admin/stats')
@role_required('admin')
def admin_stats():
    # сбор статистики
    new_pet_requests = AnimalRequest.query.filter_by(status='новая').count()
    pending_reg = RegistrationRequest.query.filter_by(status='ожидает').count()
    animals_total = Animal.query.count()
    adopted_total = Animal.query.filter_by(status='пристроен').count()

    animal_statuses = ['ищет дом', 'на передержке', 'пристроен', 'выбыло']
    animals_by_status = {s: Animal.query.filter_by(status=s).count() for s in animal_statuses}
    animals_by_status['total'] = animals_total

    req_statuses = ['новая', 'в обработке', 'одобрена', 'отклонена', 'закрыта']
    req_by_status = {s: AnimalRequest.query.filter_by(status=s).count() for s in req_statuses}
    req_by_status['total'] = AnimalRequest.query.count()

    return jsonify({'ok': True, 'kpi': {'new_pet_requests': new_pet_requests, 'pending_registrations': pending_reg, 'animals_in_shelter': animals_total, 'adopted_total': adopted_total}, 'animals_by_status': animals_by_status, 'animal_requests_by_status': req_by_status})


def _request_to_dict(req: AnimalRequest):
    return {
        'id': req.id,
        'animal_id': req.animal_id,
        'animal_name': req.animal.name if req.animal else None,
        'full_name': req.full_name,
        'phone': req.phone,
        'email': req.email,
        'living_conditions': req.living_conditions,
        'experience': req.experience,
        'additional_comments': req.additional_comments,
        'status': req.status,
        'created_at': dt_to_str(req.created_at),
    }
