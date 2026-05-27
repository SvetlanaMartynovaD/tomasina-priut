from flask import request


def json_payload():
    #Упрощает чтение JSON из запросов
    return request.get_json(silent=True) or {}


def normalize(value):
    #преоброзование к единому формату
    return str(value or '').strip()

