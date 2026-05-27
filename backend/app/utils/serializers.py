from datetime import date, datetime


def dt_to_str(value):
    #преобразует объекты date/datetime в строковый формат для JSON
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(value, date):
        return value.isoformat()
    return None


def animal_to_dict(a):
    #превращает объект питомца из БД в словарь для отправки клиенту
    return {
        'id': a.id,
        'name': a.name,
        'gender': a.gender,
        'age_category': a.age_category,
        'color': a.color,
        'arrival_date': dt_to_str(a.arrival_date),
        'description': a.description,
        'photo_url': a.photo_url,
        'status': a.status,
    }


def news_to_card_dict(n):
    #краткая версия новости для отображения в списке
    content = n.content or ''
    return {
        'id': n.id,
        'title': n.title,
        'preview': content[:180],
        'cover_photo': n.photos[0].photo_url if n.photos else None,
        'created_at': dt_to_str(n.created_at),
        'type': n.type,
    }


def news_to_detail_dict(n):
    #полная версия новости
    return {
        'id': n.id,
        'title': n.title,
        'content': n.content,
        'created_at': dt_to_str(n.created_at),
        'author_id': n.author_id,
        'type': n.type,
        'event_date': dt_to_str(n.event_date),
        'event_place': n.event_place,
        'photos': [
            {'id': p.id, 'photo_url': p.photo_url, 'sort_order': p.sort_order}
            for p in sorted(n.photos, key=lambda x: x.sort_order)
        ],
        'cover_photo': n.photos[0].photo_url if n.photos else None,
    }

