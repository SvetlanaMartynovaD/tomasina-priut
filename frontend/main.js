
// ГЛОБАЛЬНЫЕ НАСТРОЙКИ (для всех страниц)
const IN_FRONTEND_DIR = /\/frontend\//i.test(window.location.pathname);

// Поменяйте на (адрес сайта на хостинге)
const API_BASE = 'https://tomasp-svetlanamartinova2409.amvera.io/api/';


const HOME_PATH = IN_FRONTEND_DIR ? '../index.html' : 'index.html';
const FRONTEND_PREFIX = IN_FRONTEND_DIR ? '' : 'frontend/';
const pageHref = (file) => `${FRONTEND_PREFIX}${file}`;

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ЗАПРОСА К API
const apiRequest = async (route, options = {}) => {
  const response = await fetch(`${API_BASE}${route}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let payload = {};
  try { payload = await response.json(); } catch (_) {}
  return { response, payload };
};

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
const qs = new URLSearchParams(window.location.search);

const globalSearchForm = document.querySelector('.search-form');
const globalSearchInput = globalSearchForm ? globalSearchForm.querySelector('input[type="search"]') : null;


// ГЛОБАЛЬНЫЙ ПОИСК ПО СТРАНИЦЕ (Ctrl+F)
if (globalSearchForm && globalSearchInput) {
  globalSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = normalizeText(globalSearchInput.value);
    if (!q) return;
    // Встроенная функция браузера для поиска текста на странице
    const found = typeof window.find === 'function' ? window.find(q, false, false, true, false, false, false) : false;
    if (!found) window.alert('По запросу ничего не найдено на этой странице.');
  });
}



// АВТОРИЗАЦИЯ И ПОЛЬЗОВАТЕЛИ

// Функция для отображения ошибки под полем формы
const setFieldError = (form, name, text) => {
  const field = form.querySelector(`[name="${name}"]`);
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (!field || !error) return;
  field.classList.add('invalid');
  error.textContent = text;
};

// Функция для очистки ошибки под полем формы
const clearFieldError = (form, name) => {
  const field = form.querySelector(`[name="${name}"]`);
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (!field || !error) return;
  field.classList.remove('invalid');
  error.textContent = '';
};

// Очищает текст от лишних пробелов в начале и конце
const normalizeText = (v = '') => String(v).trim();
// Проверяет корректность email с помощью регулярного выражения
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Получение данных текущего пользователя с сервера
const getCurrentUser = async () => {
  try {
    const { response, payload } = await apiRequest('me', { method: 'GET' });
    return response.ok && payload.ok ? payload.user : null;
  } catch (_) {
    return null;
  }
};

// Адаптация интерфейса под роль пользователя (шапка, подвал, ссылки)
const applyAuthenticatedChrome = (user) => {
  if (!user) return;

  const profileHref = user.role === 'admin'
    ? `${FRONTEND_PREFIX}admin.html#profile`
    : user.role === 'worker'
      ? `${FRONTEND_PREFIX}worker.html#profile`
      : HOME_PATH;
  const statsHref = user.role === 'admin'
    ? `${FRONTEND_PREFIX}stats.html`
    : user.role === 'worker'
      ? `${FRONTEND_PREFIX}worker.html#worker-new-requests`
      : `${HOME_PATH}#news`;

  const headerLinks = document.querySelector('.auth-links, .admin-auth-links');
  if (headerLinks) {
    headerLinks.className = 'auth-links auth-logged';
    headerLinks.innerHTML = `
      <a href="${profileHref}">Профиль</a>
      <button type="button" class="auth-logout-btn">Выйти</button>
    `;
  }

  const footerNavs = document.querySelectorAll('.site-footer .footer-nav');
  if (footerNavs.length >= 2) {
    footerNavs[1].innerHTML = user.role === 'worker'
      ? `<li><a href="${profileHref}">Профиль</a></li>`
      : `
          <li><a href="${profileHref}">Профиль</a></li>
          <li><a href="${statsHref}">Статистика</a></li>
        `;
  }
};

// Бургер-меню для мобильных устройств (открытие/закрытие навигации)
document.querySelector('.burger')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});

// Обработчик кнопки "Выйти" (работает на всех страницах через делегирование)
document.addEventListener('click', async (e) => {
  const logoutBtn = e.target.closest('.auth-logout-btn, #admin-logout, #worker-logout');
  if (!logoutBtn) return;
  e.preventDefault();
  try {
    await apiRequest('logout', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    window.location.href = pageHref('login.html');
  }
});

// Первоначальная загрузка страницы: проверяем пользователя и адаптируем интерфейс
(async () => {
  const user = await getCurrentUser();
  applyAuthenticatedChrome(user);

  const addBtn = document.querySelector('[data-admin-only]');
  const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
  if (addBtn) addBtn.hidden = !isStaff;
})();

// Скрываем кнопки добавления 
const rulesTotalCount = document.querySelector('#rules-total-count');
if (rulesTotalCount) {
  apiRequest('animals?limit=1&offset=0', { method: 'GET' }).then(({ response, payload }) => {
    if (!response.ok || !payload.ok) return;
    rulesTotalCount.textContent = String(payload.total ?? 0);
  }).catch(() => {});
}



// ГЛАВНАЯ СТРАНИЦА 

// Загружает и отображает 3 последние новости
const homeNewsGrid = document.querySelector('#home-news-grid');
if (homeNewsGrid) {
  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  // Генерация HTML карточки новости
  const cardHtml = (item) => {
    const img = item.cover_photo || 'assets/placeholders/photo-placeholder.svg';
    return `
      <article class="news-card">
        <img src="${esc(img)}" alt="${esc(item.title || 'Новость')}" />
        <h3>${esc(item.title || 'Без названия')}</h3>
        <a href="${pageHref(`news-item.html?id=${item.id}`)}" class="news-link">Подробнее...</a>
      </article>
    `;
  };

  apiRequest('news?limit=3&offset=0', { method: 'GET' })
    .then(({ response, payload }) => {
      if (!response.ok || !payload.ok) {
        homeNewsGrid.innerHTML = '<p class="news-fallback">Не удалось загрузить новости.</p>';
        return;
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) {
        homeNewsGrid.innerHTML = '<p class="news-fallback">Новостей пока нет.</p>';
        return;
      }

      homeNewsGrid.innerHTML = items.map(cardHtml).join('');
    })
    .catch(() => {
      homeNewsGrid.innerHTML = '<p class="news-fallback">Не удалось загрузить новости.</p>';
    });
}


// СТРАНИЦА НОВОСТЕЙ

// Бесконечная прокрутка (infinite scroll)
const newsFeedGrid = document.querySelector('#news-feed-grid');
if (newsFeedGrid) {
  const newsTotalCount = document.querySelector('#news-total-count');
  const newsEnd = document.querySelector('#news-feed-end');
  const addNewsBtn = document.querySelector('#add-news-btn');
  const state = { offset: 0, limit: 10, total: 0, loading: false, finished: false };
  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  // Генерация HTML карточки новости для ленты
  const cardHtml = (item) => {
    const img = item.cover_photo || 'assets/placeholders/photo-placeholder.svg';
    return `
      <article class="news-feed-card">
        <img src="${esc(img)}" alt="${esc(item.title)}" />
        <div class="news-feed-content">
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.preview || '')}</p>
          <a class="news-feed-link" href="${pageHref(`news-item.html?id=${item.id}`)}">Подробнее...</a>
        </div>
      </article>
    `;
  };
  // Функция загрузки следующей порции новостей
  const loadNews = async () => {
    if (state.loading || state.finished) return;
    state.loading = true;
    const { response, payload } = await apiRequest(`news?limit=${state.limit}&offset=${state.offset}`, { method: 'GET' });
    state.loading = false;
    if (!response.ok || !payload.ok) return;

    state.total = Number(payload.total || 0);
    if (newsTotalCount) newsTotalCount.textContent = String(state.total);

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      state.finished = true;
      if (newsEnd) newsEnd.hidden = false;
      return;
    }

    newsFeedGrid.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
    state.offset += items.length;

    if (state.offset >= state.total) {
      state.finished = true;
      if (newsEnd) newsEnd.hidden = false;
    }
  };

  const sentinel = document.createElement('div');
  sentinel.className = 'news-scroll-sentinel';
  newsFeedGrid.after(sentinel);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadNews();
    });
  }, { rootMargin: '220px 0px' });
  observer.observe(sentinel);

  // Скрываем кнопку добавления новости для не-сотрудников
  getCurrentUser().then((user) => {
    const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
    if (addNewsBtn) addNewsBtn.hidden = !isStaff;
  });
  loadNews();
}



// СТРАНИЦА ОТДЕЛЬНОЙ НОВОСТИ 

// Полная новость, комментарии, слайдер фотографий
const newsItemRoot = document.querySelector('#news-item-root');
if (newsItemRoot) {
  const id = parseInt(qs.get('id') || '0', 10);
  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  if (!id || Number.isNaN(id)) {
    newsItemRoot.innerHTML = '<p class="news-item-error">Новость не выбрана.</p>';
  } else {
    // Параллельная загрузка: пользователь, новость, комментарии
    Promise.all([
      getCurrentUser(),
      apiRequest(`news/${id}`, { method: 'GET' }),
      apiRequest(`news/${id}/comments`, { method: 'GET' }),
    ]).then(([user, newsRes, commentsRes]) => {
      const { response, payload } = newsRes;
      if (!response.ok || !payload.ok || !payload.news) {
        newsItemRoot.innerHTML = `<p class="news-item-error">${esc(payload.message || 'Новость не найдена.')}</p>`;
        return;
      }

      const n = payload.news;
      const photos = Array.isArray(n.photos) && n.photos.length ? n.photos.map((p) => p.photo_url) : ['assets/placeholders/photo-placeholder.svg'];
      let photoIndex = 0;

      const comments = (commentsRes.response.ok && commentsRes.payload.ok && Array.isArray(commentsRes.payload.items))
        ? commentsRes.payload.items
        : [];
      const commentsState = { expanded: false, items: comments };
      const isAdmin = !!(user && user.role === 'admin');
      const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));

      newsItemRoot.innerHTML = `
        <section class="news-item-top">
          <div class="news-item-media">
            <img id="news-item-photo" src="${esc(photos[0])}" alt="${esc(n.title)}" />
            <button class="news-slider-btn prev" type="button" aria-label="Предыдущее фото">‹</button>
            <button class="news-slider-btn next" type="button" aria-label="Следующее фото">›</button>
          </div>
          <div class="news-item-body">
            <div class="news-item-heading-row">
              <h1 class="news-item-title">${esc(n.title)}</h1>
              ${isStaff ? `
                <div class="news-item-admin-actions">
                  <a href="add-news.html?id=${n.id}" class="news-item-edit">Редактирование</a>
                  ${isAdmin ? '<button type="button" class="news-item-delete" data-delete-news="' + n.id + '" aria-label="Удалить новость">Удалить</button>' : ''}
                </div>
              ` : ''}
            </div>
            <p class="news-item-text">${esc(n.content || '')}</p>
          </div>
        </section>

        <section class="news-comments">
          <h2>Коментарии</h2>
          <div class="news-comments-grid" id="news-comments-grid"></div>
          <div class="news-comments-toggle"><button type="button" id="news-comments-toggle-btn">Смотреть все комментарии ›</button></div>
        </section>

        <section class="news-comment-form">
          <h2>Добавь комментарий</h2>
          <form class="news-comment-form-box" id="news-comment-form" novalidate>
            <input name="name" placeholder="Имя" />
            <input name="email" placeholder="Email" />
            <textarea name="content" placeholder="Текст комментария"></textarea>
            <button type="submit" class="btn news-comment-submit">Написать</button>
            <p class="news-comment-message" id="news-comment-message"></p>
          </form>
          <a href="news.html" class="news-item-back">Назад к новостям</a>
        </section>
      `;

      if (user) {
        const nameField = newsItemRoot.querySelector('#news-comment-form [name="name"]');
        const emailField = newsItemRoot.querySelector('#news-comment-form [name="email"]');
        if (nameField && user.username) nameField.value = user.username;
        if (emailField && user.email) emailField.value = user.email;
      }

      const imgEl = newsItemRoot.querySelector('#news-item-photo');
      const prevBtn = newsItemRoot.querySelector('.news-slider-btn.prev');
      const nextBtn = newsItemRoot.querySelector('.news-slider-btn.next');
      const renderPhoto = () => {
        if (!imgEl) return;
        imgEl.src = photos[photoIndex];
      };
      prevBtn?.addEventListener('click', () => {
        photoIndex = (photoIndex - 1 + photos.length) % photos.length;
        renderPhoto();
      });
      nextBtn?.addEventListener('click', () => {
        photoIndex = (photoIndex + 1) % photos.length;
        renderPhoto();
      });
      if (photos.length <= 1) {
        prevBtn?.setAttribute('hidden', 'hidden');
        nextBtn?.setAttribute('hidden', 'hidden');
      }

      const deleteNewsBtn = newsItemRoot.querySelector('[data-delete-news]');
      deleteNewsBtn?.addEventListener('click', async () => {
        if (!window.confirm('Удалить эту новость? Действие нельзя отменить.')) return;
        deleteNewsBtn.disabled = true;
        const del = await apiRequest(`admin/news/${n.id}/delete`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (!del.response.ok || !del.payload.ok) {
          deleteNewsBtn.disabled = false;
          window.alert(del.payload.message || 'Не удалось удалить новость');
          return;
        }
        window.location.href = 'news.html';
      });

      const commentsGrid = newsItemRoot.querySelector('#news-comments-grid');
      const toggleBtn = newsItemRoot.querySelector('#news-comments-toggle-btn');
      const renderComments = () => {
        if (!commentsGrid) return;
        const visible = commentsState.expanded ? commentsState.items : commentsState.items.slice(0, 3);
        if (!visible.length) {
          commentsGrid.innerHTML = '<div class="news-comment-card"><p class="news-comment-name">Пока нет комментариев</p><p class="news-comment-text">Станьте первым, кто оставит комментарий.</p></div>';
          if (toggleBtn) toggleBtn.hidden = true;
          return;
        }
        commentsGrid.innerHTML = visible.map((c) => `
          <article class="news-comment-card">
            <div class="news-comment-head">
              <p class="news-comment-name">${esc(c.name || 'Гость')}</p>
              ${isAdmin ? `<button type="button" class="news-comment-delete" data-delete-comment="${c.id}" aria-label="Удалить комментарий">Удалить</button>` : ''}
            </div>
            <p class="news-comment-text">${esc(c.content || '')}</p>
          </article>
        `).join('');
        if (toggleBtn) {
          toggleBtn.hidden = commentsState.items.length <= 3;
          toggleBtn.textContent = commentsState.expanded ? 'Свернуть комментарии ‹' : 'Смотреть все комментарии ›';
        }
      };
      toggleBtn?.addEventListener('click', () => {
        commentsState.expanded = !commentsState.expanded;
        renderComments();
      });
      renderComments();

      commentsGrid?.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-delete-comment]');
        if (!deleteBtn || !isAdmin) return;
        const commentId = Number(deleteBtn.getAttribute('data-delete-comment'));
        if (!commentId) return;
        if (!window.confirm('Удалить комментарий?')) return;

        deleteBtn.disabled = true;
        const delRes = await apiRequest(`admin/comments/${commentId}/delete`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (!delRes.response.ok || !delRes.payload.ok) {
          deleteBtn.disabled = false;
          window.alert(delRes.payload.message || 'Не удалось удалить комментарий.');
          return;
        }

        commentsState.items = commentsState.items.filter((c) => Number(c.id) !== commentId);
        renderComments();
      });

      const commentForm = newsItemRoot.querySelector('#news-comment-form');
      const commentMessage = newsItemRoot.querySelector('#news-comment-message');
      commentForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!commentMessage) return;
        commentMessage.textContent = '';
        const name = normalizeText(commentForm.name.value);
        const email = normalizeText(commentForm.email.value);
        const content = normalizeText(commentForm.content.value);
        if (!name || !email || !content) {
          commentMessage.textContent = 'Заполните имя, email и текст комментария.';
          commentMessage.className = 'news-comment-message error';
          return;
        }
        if (!isEmail(email)) {
          commentMessage.textContent = 'Некорректный email.';
          commentMessage.className = 'news-comment-message error';
          return;
        }

        const res = await apiRequest(`news/${id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ name, email, content }),
        });
        if (!res.response.ok || !res.payload.ok) {
          commentMessage.textContent = res.payload.message || 'Не удалось добавить комментарий.';
          commentMessage.className = 'news-comment-message error';
          return;
        }
        commentMessage.textContent = res.payload.message || 'Комментарий добавлен.';
        commentMessage.className = 'news-comment-message ok';
        commentForm.content.value = '';

        const reload = await apiRequest(`news/${id}/comments`, { method: 'GET' });
        if (reload.response.ok && reload.payload.ok && Array.isArray(reload.payload.items)) {
          commentsState.items = reload.payload.items;
          renderComments();
        }
      });
    });
  }
}


// СТРАНИЦА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ НОВОСТИ

const addNewsForm = document.querySelector('#add-news-form');
if (addNewsForm) {
  const message = document.querySelector('#add-news-message');
  const titleEl = document.querySelector('.add-news-section h1');
  const submitBtn = addNewsForm.querySelector('.add-news-submit');
  const editNewsId = parseInt(qs.get('id') || '0', 10);
  const isEditMode = !!(editNewsId && !Number.isNaN(editNewsId));

  (async () => {
    const user = await getCurrentUser();
    const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
    if (!isStaff) {
      window.location.href = 'login.html';
      return;
    }

    if (isEditMode) {
      const detail = await apiRequest(`admin/news/${editNewsId}`, { method: 'GET' });
      if (!detail.response.ok || !detail.payload.ok || !detail.payload.news) {
        message.textContent = detail.payload.message || 'Новость не найдена.';
        message.className = 'add-news-message error';
        [...addNewsForm.elements].forEach((el) => { el.disabled = true; });
        return;
      }

      const n = detail.payload.news;
      if (titleEl) titleEl.textContent = 'Редактировать новость';
      if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
      addNewsForm.title.value = n.title || '';
      addNewsForm.type.value = n.type || 'новость';
      addNewsForm.content.value = n.content || '';
      const photos = Array.isArray(n.photos) ? n.photos : [];
      addNewsForm.photo_1.value = photos[0] || '';
      addNewsForm.photo_2.value = photos[1] || '';
      addNewsForm.photo_3.value = photos[2] || '';
    }
  })();

  addNewsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';

    const title = normalizeText(addNewsForm.title.value);
    const type = normalizeText(addNewsForm.type.value);
    const content = normalizeText(addNewsForm.content.value);
    const photos = [
      normalizeText(addNewsForm.photo_1?.value || ''),
      normalizeText(addNewsForm.photo_2?.value || ''),
      normalizeText(addNewsForm.photo_3?.value || ''),
    ].filter(Boolean);

    if (!title || !content || !type) {
      message.textContent = 'Заполните обязательные поля.';
      message.className = 'add-news-message error';
      return;
    }

    const route = isEditMode ? `admin/news/${editNewsId}` : 'admin/news';
    const { response, payload } = await apiRequest(route, {
      method: 'POST',
      body: JSON.stringify({ title, type, content, event_date: '', event_place: '', photos }),
    });

    if (!response.ok || !payload.ok) {
      message.textContent = payload.message || 'Не удалось добавить новость.';
      message.className = 'add-news-message error';
      return;
    }

    message.textContent = payload.message || (isEditMode ? 'Новость обновлена.' : 'Новость добавлена.');
    message.className = 'add-news-message ok';
    setTimeout(() => {
      window.location.href = `news-item.html?id=${payload.id || editNewsId}`;
    }, 250);
  });
}


// СТРАНИЦА РЕГИСТРАЦИИ

const registerForm = document.querySelector('#register-form');
if (registerForm) {
  const message = document.querySelector('#register-message');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['first_name','last_name','phone','email','password','confirm_password'].forEach((n) => clearFieldError(registerForm, n));
    message.textContent = '';

    const first_name = normalizeText(registerForm.first_name.value);
    const last_name = normalizeText(registerForm.last_name.value);
    const phone = normalizeText(registerForm.phone.value);
    const email = normalizeText(registerForm.email.value);
    const password = registerForm.password.value;
    const confirm_password = registerForm.confirm_password.value;
    const about = normalizeText(registerForm.about?.value || '');

    let hasError = false;
    if (!first_name) { setFieldError(registerForm, 'first_name', 'Введите имя'); hasError = true; }
    if (!last_name) { setFieldError(registerForm, 'last_name', 'Введите фамилию'); hasError = true; }
    if (phone.replace(/\D/g, '').length < 11) { setFieldError(registerForm, 'phone', 'Некорректный телефон'); hasError = true; }
    if (!isEmail(email)) { setFieldError(registerForm, 'email', 'Некорректный email'); hasError = true; }
    if (!password || password.length < 6) { setFieldError(registerForm, 'password', 'Минимум 6 символов'); hasError = true; }
    if (confirm_password !== password) { setFieldError(registerForm, 'confirm_password', 'Пароли не совпадают'); hasError = true; }

    if (hasError) {
      message.textContent = 'Проверьте поля формы.';
      message.className = 'register-message error';
      return;
    }

    const { response, payload } = await apiRequest('register-request', {
      method: 'POST',
      body: JSON.stringify({ first_name, last_name, phone, email, password, about }),
    });

    message.textContent = payload.message || (response.ok ? 'Заявка отправлена.' : 'Ошибка отправки');
    message.className = `register-message ${response.ok && payload.ok ? 'ok' : 'error'}`;
    if (response.ok && payload.ok) registerForm.reset();
  });
}


// СТРАНИЦА ВХОДА

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  const message = document.querySelector('#login-message');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['login_email','login_password'].forEach((n) => clearFieldError(loginForm, n));
    message.textContent = '';

    const email = normalizeText(loginForm.login_email.value);
    const password = loginForm.login_password.value;

    let hasError = false;
    if (!isEmail(email)) { setFieldError(loginForm, 'login_email', 'Некорректный email'); hasError = true; }
    if (!password || password.length < 6) { setFieldError(loginForm, 'login_password', 'Минимум 6 символов'); hasError = true; }
    if (hasError) return;

    const { response, payload } = await apiRequest('login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok || !payload.ok) {
      message.textContent = payload.message || 'Ошибка входа';
      message.className = 'login-message error';
      return;
    }

    message.textContent = 'Вход выполнен';
    message.className = 'login-message ok';
    setTimeout(() => {
      if (payload.user?.role === 'admin') {
        window.location.href = 'admin.html';
        return;
      }
      if (payload.user?.role === 'worker') {
        window.location.href = 'worker.html';
        return;
      }
      window.location.href = HOME_PATH;
    }, 200);
  });
}


// СТРАНИЦА ЗАЯВКИ НА ПИТОМЦА
const petRequestForm = document.querySelector('#pet-request-form');
if (petRequestForm) {
  const message = document.querySelector('#pet-request-message');
  const petName = document.querySelector('#pet-request-name');
  const animalId = parseInt(qs.get('animal_id') || '0', 10);

  const setBlocked = (text) => {
    message.textContent = text;
    message.className = 'pet-request-message error';
    [...petRequestForm.elements].forEach((el) => { if (el.tagName !== 'BUTTON') el.disabled = true; });
    const submit = petRequestForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
  };

  if (!animalId || Number.isNaN(animalId)) {
    setBlocked('Не выбран питомец для заявки.');
  } else {
    apiRequest(`pet-request-form-meta?animal_id=${animalId}`, { method: 'GET' }).then(({ response, payload }) => {
      if (!response.ok || !payload.ok) {
        setBlocked(payload.message || 'Питомец не найден.');
        return;
      }
      if (petName) petName.textContent = payload.pet_name || 'Кличка';
    });
  }

  petRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['pet_first_name','pet_last_name','pet_phone','pet_email','living_conditions'].forEach((n) => clearFieldError(petRequestForm, n));
    message.textContent = '';

    const first_name = normalizeText(petRequestForm.pet_first_name.value);
    const last_name = normalizeText(petRequestForm.pet_last_name.value);
    const patronymic = normalizeText(petRequestForm.pet_patronymic.value);
    const phone = normalizeText(petRequestForm.pet_phone.value);
    const email = normalizeText(petRequestForm.pet_email.value);
    const living_conditions = normalizeText(petRequestForm.living_conditions.value);
    const experience = normalizeText(petRequestForm.experience.value);
    const about = normalizeText(petRequestForm.pet_about.value);

    let hasError = false;
    if (!first_name) { setFieldError(petRequestForm, 'pet_first_name', 'Введите имя'); hasError = true; }
    if (!last_name) { setFieldError(petRequestForm, 'pet_last_name', 'Введите фамилию'); hasError = true; }
    if (phone.replace(/\D/g, '').length < 11) { setFieldError(petRequestForm, 'pet_phone', 'Некорректный телефон'); hasError = true; }
    if (!isEmail(email)) { setFieldError(petRequestForm, 'pet_email', 'Некорректный email'); hasError = true; }
    if (!living_conditions) { setFieldError(petRequestForm, 'living_conditions', 'Опишите условия'); hasError = true; }
    if (hasError) return;

    const { response, payload } = await apiRequest('pet-request', {
      method: 'POST',
      body: JSON.stringify({ animal_id: animalId, first_name, last_name, patronymic, phone, email, living_conditions, experience, about }),
    });

    message.textContent = payload.message || (response.ok ? 'Заявка отправлена.' : 'Ошибка отправки');
    message.className = `pet-request-message ${response.ok && payload.ok ? 'ok' : 'error'}`;
    if (response.ok && payload.ok) petRequestForm.reset();
  });
}

// КАТАЛОГ ПИТОМЦЕВ

const petsPageGrid = document.querySelector('#pets-grid');
if (petsPageGrid) {
  const summary = document.querySelector('#pets-total-count');
  const loadMoreBtn = document.querySelector('#pets-load-more');
  const colorFilterBox = document.querySelector('#pets-color-filter-box');
  const filterBoxes = document.querySelectorAll('[data-filter-group]');
  const addPetBtn = document.querySelector('#add-pet-btn');
  const state = {
    offset: 0,
    limit: 8,
    total: 0,
    filters: { age: [], gender: [], color: [] },
    loading: false,
    pendingReset: false,
  };

  const collectFilters = () => {
    const collect = (group) => [...document.querySelectorAll(`input[data-filter="${group}"]:checked`)].map((el) => el.value);
    state.filters.age = collect('age');
    state.filters.gender = collect('gender');
    state.filters.color = collect('color');
  };

  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const renderColorFilters = (colors) => {
    if (!colorFilterBox) return;
    if (!Array.isArray(colors) || !colors.length) {
      colorFilterBox.innerHTML = '<p class="pets-filter-empty">Нет доступных окрасов</p>';
      return;
    }

    colorFilterBox.innerHTML = colors.map((color) => (
      `<label><input type="checkbox" data-filter="color" value="${esc(color)}" /> ${esc(color)}</label>`
    )).join('');
  };

  const loadColorFilters = async () => {
    const { response, payload } = await apiRequest('animals/colors', { method: 'GET' });
    if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
      renderColorFilters([]);
      return;
    }
    renderColorFilters(payload.items);
  };

  const cardHtml = (item) => {
    const img = item.photo_url || 'assets/placeholders/photo-placeholder.svg';
    const safeColor = item.color || '-';
    const safeAge = item.age_category || '-';
    const safeGender = item.gender || '-';
    return `<article class="pets-card">
      <img src="${img}" alt="${item.name}" />
      <h3>${item.name}</h3>
      <p><span class="pets-field-label">Возрастная группа:</span> <span class="pets-field-value">${safeAge}</span></p>
      <p><span class="pets-field-label">Окрас:</span> <span class="pets-field-value">${safeColor}</span></p>
      <p><span class="pets-field-label">Пол:</span> <span class="pets-field-value">${safeGender}</span></p>
      <a class="pets-card-link" href="pet-profile.html?id=${item.id}">Подробнее о питомце...</a>
    </article>`;
  };

  const loadPets = async ({ reset = false } = {}) => {
    if (state.loading) {
      if (reset) state.pendingReset = true;
      return;
    }
    state.loading = true;
    if (reset) {
      state.offset = 0;
      petsPageGrid.innerHTML = '';
    }

    const query = new URLSearchParams();
    query.set('limit', String(state.limit));
    query.set('offset', String(state.offset));
    if (state.filters.age.length) query.set('age', state.filters.age.join(','));
    if (state.filters.gender.length) query.set('gender', state.filters.gender.join(','));
    if (state.filters.color.length) query.set('color', state.filters.color.join(','));

    const { response, payload } = await apiRequest(`animals?${query.toString()}`, { method: 'GET' });
    state.loading = false;

    if (!response.ok || !payload.ok) {
      if (state.pendingReset) {
        state.pendingReset = false;
        loadPets({ reset: true });
      }
      return;
    }

    state.total = payload.total || 0;
    const items = Array.isArray(payload.items) ? payload.items : [];
    petsPageGrid.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
    state.offset += items.length;

    if (summary) summary.textContent = state.total;
    if (loadMoreBtn) loadMoreBtn.hidden = state.offset >= state.total;

    if (state.pendingReset) {
      state.pendingReset = false;
      loadPets({ reset: true });
    }
  };

  loadMoreBtn?.addEventListener('click', () => loadPets({ reset: false }));

  const filterWraps = [...document.querySelectorAll('.pets-filter')];
  const closeAllFilters = () => filterWraps.forEach((w) => w.classList.remove('open'));

  document.querySelectorAll('.pets-filter-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wrap = btn.closest('.pets-filter');
      if (!wrap) return;
      const shouldOpen = !wrap.classList.contains('open');
      closeAllFilters();
      if (shouldOpen) wrap.classList.add('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pets-filter')) {
      closeAllFilters();
    }
  });

  filterBoxes.forEach((box) => {
    box.addEventListener('change', () => {
      collectFilters();
      loadPets({ reset: true });
    });
  });

  getCurrentUser().then((user) => {
    const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
    if (addPetBtn) addPetBtn.hidden = !isStaff;
  });

  (async () => {
    await loadColorFilters();
    collectFilters();
    loadPets({ reset: true });
  })();
}


// ПРОФИЛЬ ПИТОМЦА
const petProfileRoot = document.querySelector('#pet-profile-root');
if (petProfileRoot) {
  const id = parseInt(qs.get('id') || '0', 10);
  if (!id || Number.isNaN(id)) {
    petProfileRoot.innerHTML = '<p class="profile-error">Питомец не выбран.</p>';
  } else {
    Promise.all([getCurrentUser(), apiRequest(`animal?id=${id}`, { method: 'GET' })]).then(([user, { response, payload }]) => {
      if (!response.ok || !payload.ok || !payload.animal) {
        petProfileRoot.innerHTML = `<p class="profile-error">${payload.message || 'Питомец не найден.'}</p>`;
        return;
      }
      const a = payload.animal;
      const img = a.photo_url || 'assets/placeholders/photo-placeholder.svg';
      const isAdmin = !!(user && user.role === 'admin');
      const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
      const statusMap = {
        'ищет дом': 'В поисках дома',
        'на передержке': 'На передержке',
        'пристроен': 'Пристроен',
        'выбыло': 'Выбыл',
      };
      const statusText = statusMap[a.status] || a.status || 'В поисках дома';
      const arrivalDate = a.arrival_date ? a.arrival_date.split('-').reverse().join('.') : '—';
      const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
      const adminStatusControls = isStaff ? `
        <div class="pet-profile-status-edit">
          <label for="pet-status-select">Статус:</label>
          <select id="pet-status-select">
            <option value="ищет дом" ${a.status === 'ищет дом' ? 'selected' : ''}>Ищет дом</option>
            <option value="на передержке" ${a.status === 'на передержке' ? 'selected' : ''}>На передержке</option>
            <option value="пристроен" ${a.status === 'пристроен' ? 'selected' : ''}>Пристроен</option>
            <option value="выбыло" ${a.status === 'выбыло' ? 'selected' : ''}>Выбыл</option>
          </select>
          <button type="button" class="pet-status-save" data-save-pet-status="${a.id}">Сохранить</button>
          <p class="pet-status-message" id="pet-status-message"></p>
        </div>
      ` : '';
      const adminActions = isStaff ? `
        <div class="pet-profile-admin-actions">
          <a href="add-pet.html?id=${a.id}" class="pet-profile-edit">Редактирование</a>
          ${isAdmin ? '<button type="button" class="pet-profile-delete" data-delete-animal="' + a.id + '" aria-label="Удалить питомца"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z"/></svg></button>' : ''}
        </div>` : '';

      petProfileRoot.innerHTML = `
        <section class="pet-profile-hero">
          <img src="${img}" alt="${esc(a.name)}" class="pet-profile-photo" />
          <div class="pet-profile-side">
            <div class="pet-profile-topline">
              <h1>${esc(a.name)}</h1>
              <span class="pet-profile-state">${esc(statusText)}</span>
              ${adminActions}
            </div>
            <div class="pet-profile-meta-card">
              <div class="pet-profile-row"><span>Пол:</span><b>${esc(a.gender)}</b></div>
              <div class="pet-profile-row"><span>Возрастная категория:</span><b>${esc(a.age_category)}</b></div>
              <div class="pet-profile-row"><span>Окрас:</span><b>${esc(a.color)}</b></div>
              <div class="pet-profile-row"><span>Дата поступления в приют:</span><b>${esc(arrivalDate)}</b></div>
              ${adminStatusControls}
              <a class="btn pet-profile-cta" href="pet-request.html?animal_id=${a.id}">Хочу забрать домой</a>
            </div>
          </div>
        </section>
        <section class="pet-profile-text-block">
          <h2>Все обо мне:</h2>
          <div class="pet-profile-text">${esc(a.description)}</div>
        </section>
        <section class="pet-profile-text-block">
          <h2>Условия передачи</h2>
          <div class="pet-profile-text">Животное отдаётся только в собственное жилье. При съёмном жилье требуется письменное согласие собственника. Обязательно наличие переноски. Возраст владельцу от 25 до 60 лет. Подробнее с правилами можно ознакомиться на странице "Правила передачи животных".</div>
          <a class="pet-profile-rules-link" href="rules.html">Правила передачи животных</a>
        </section>`;

      petProfileRoot.querySelector('[data-delete-animal]')?.addEventListener('click', async (e) => {
        const animalId = e.currentTarget.getAttribute('data-delete-animal');
        if (!animalId) return;
        if (!window.confirm('Удалить питомца? Это действие нельзя отменить.')) return;

        const del = await apiRequest(`admin/animals/${animalId}/delete`, { method: 'POST', body: JSON.stringify({}) });
        if (!del.response.ok || !del.payload.ok) {
          window.alert(del.payload.message || 'Не удалось удалить питомца');
          return;
        }
        window.location.href = 'pets.html';
      });

      petProfileRoot.querySelector('[data-save-pet-status]')?.addEventListener('click', async (e) => {
        const animalId = e.currentTarget.getAttribute('data-save-pet-status');
        const statusSelect = petProfileRoot.querySelector('#pet-status-select');
        const statusMessage = petProfileRoot.querySelector('#pet-status-message');
        const statusLabel = petProfileRoot.querySelector('.pet-profile-state');
        if (!animalId || !statusSelect || !statusLabel) return;

        const status = statusSelect.value;
        e.currentTarget.disabled = true;
        if (statusMessage) {
          statusMessage.textContent = '';
          statusMessage.className = 'pet-status-message';
        }

        const res = await apiRequest(`admin/animals/${animalId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        });
        e.currentTarget.disabled = false;

        if (!res.response.ok || !res.payload.ok) {
          if (statusMessage) {
            statusMessage.textContent = res.payload.message || 'Не удалось обновить статус';
            statusMessage.className = 'pet-status-message error';
          }
          return;
        }

        statusLabel.textContent = statusMap[status] || status;
        if (statusMessage) {
          statusMessage.textContent = res.payload.message || 'Статус обновлен';
          statusMessage.className = 'pet-status-message ok';
        }
      });
    });
  }
}


// ДОБАВЛЕНИЕ/РЕДАКТИРОВАНИЕ ПИТОМЦА
const addPetForm = document.querySelector('#add-pet-form');
if (addPetForm) {
  const msg = document.querySelector('#add-pet-message');
  const formTitle = document.querySelector('.add-pet-section h1');
  const submitBtn = addPetForm.querySelector('.add-pet-submit');
  const editAnimalId = parseInt(qs.get('id') || '0', 10);
  const isEditMode = !!(editAnimalId && !Number.isNaN(editAnimalId));
  const editMeta = { arrival_date: '', status: 'ищет дом' };

  (async () => {
    const user = await getCurrentUser();
    const isStaff = !!(user && (user.role === 'admin' || user.role === 'worker'));
    if (!isStaff) {
      window.location.href = 'login.html';
      return;
    }

    if (isEditMode) {
      const { response, payload } = await apiRequest(`animal?id=${editAnimalId}`, { method: 'GET' });
      if (!response.ok || !payload.ok || !payload.animal) {
        msg.textContent = payload.message || 'Питомец не найден для редактирования.';
        msg.className = 'add-pet-message error';
        [...addPetForm.elements].forEach((el) => { el.disabled = true; });
        return;
      }

      const a = payload.animal;
      editMeta.arrival_date = a.arrival_date || new Date().toISOString().slice(0, 10);
      editMeta.status = a.status || 'ищет дом';
      if (formTitle) formTitle.textContent = 'Редактировать питомца';
      if (submitBtn) submitBtn.textContent = 'Сохранить изменения';

      addPetForm.name.value = a.name || '';
      addPetForm.gender.value = a.gender || '';
      addPetForm.age_category.value = a.age_category || '';
      addPetForm.color.value = a.color || '';
      addPetForm.photo_url.value = a.photo_url || '';
      addPetForm.description.value = a.description || '';
    }
  })();

  addPetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const payload = {
      name: normalizeText(addPetForm.name.value),
      gender: addPetForm.gender.value,
      age_category: addPetForm.age_category.value,
      color: normalizeText(addPetForm.color.value),
      arrival_date: editMeta.arrival_date || new Date().toISOString().slice(0, 10),
      description: normalizeText(addPetForm.description.value),
      photo_url: normalizeText(addPetForm.photo_url.value),
      status: editMeta.status || 'ищет дом',
    };

    const route = isEditMode ? `admin/animals/${editAnimalId}` : 'admin/animals';
    const method = isEditMode ? 'POST' : 'POST';
    const { response, payload: res } = await apiRequest(route, {
      method,
      body: JSON.stringify(payload),
    });

    msg.textContent = res.message || (response.ok ? (isEditMode ? 'Питомец обновлен успешно' : 'Питомец добавлен успешно') : 'Ошибка сохранения.');
    msg.className = `add-pet-message ${response.ok && res.ok ? 'ok' : 'error'}`;
    if (response.ok && res.ok) {
      if (!isEditMode) addPetForm.reset();
      setTimeout(() => {
        window.location.href = 'pets.html';
      }, 300);
    }
  });
}

// АДМИН-ПАНЕЛЬ

const petRequestsRoot = document.querySelector('#pet-requests-grid');
const registrationRequestsRoot = document.querySelector('#registration-requests-grid');
if (petRequestsRoot && registrationRequestsRoot) {
  const messageEl = document.querySelector('#admin-message');
  const petToggleBtn = document.querySelector('[data-toggle-section="pet"]');
  const registrationToggleBtn = document.querySelector('[data-toggle-section="registration"]');
  const petRequestModal = document.querySelector('#pet-request-modal');
  const petRequestModalContent = document.querySelector('#pet-request-modal-content');
  const petRequestModalMessage = document.querySelector('#pet-request-modal-message');
  const petStatusBtns = [...document.querySelectorAll('.admin-status-btn[data-request-status]')];
  const petDeleteBtn = document.querySelector('.admin-status-btn[data-request-delete]');
  const COLLAPSED_LIMIT = 6;
  const state = { petExpanded: false, regExpanded: false, pet: [], reg: [], activePetRequestId: 0, activePetRequestStatus: '' };

  const showMessage = (text, type = '') => {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `admin-message${type ? ` ${type}` : ''}`;
  };

  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const renderPet = () => {
    const list = state.pet;
    if (!list.length) {
      petRequestsRoot.innerHTML = '<div class="admin-empty">Заявок на питомцев пока нет.</div>';
      if (petToggleBtn) petToggleBtn.style.display = 'none';
      return;
    }
    const statusUiMap = {
      'новая': 'Новая',
      'в обработке': 'В обработке',
      'одобрена': 'Одобрена',
      'отклонена': 'Отклонена',
      'закрыта': 'Закрыта',
    };
    const statusClassMap = {
      'новая': 'new',
      'в обработке': 'processing',
      'одобрена': 'approved',
      'отклонена': 'rejected',
      'закрыта': 'closed',
    };
    const visible = state.petExpanded ? list : list.slice(0, COLLAPSED_LIMIT);
    petRequestsRoot.innerHTML = visible.map((i) => {
      const rawStatus = String(i.status || 'новая').toLowerCase();
      const statusText = statusUiMap[rawStatus] || i.status || 'Новая';
      const statusClass = statusClassMap[rawStatus] || 'new';
      const petLabel = i.animal_name || (i.animal_id ? `ID ${i.animal_id}` : 'Заявка');
      return `<article class="pet-card"><div class="pet-card-top"><span class="pet-status pet-status--${statusClass}">${esc(statusText)}</span><span class="pet-number">№${String(i.id).padStart(3, '0')}</span></div><p>${esc(petLabel)}</p><button type="button" class="pet-detail" data-open-pet-request="${i.id}">Подробнее</button></article>`;
    }).join('');
    if (petToggleBtn) {
      petToggleBtn.style.display = list.length > COLLAPSED_LIMIT ? 'inline-block' : 'none';
      petToggleBtn.textContent = state.petExpanded ? 'Свернуть' : 'Смотреть все заявки';
    }
  };

  const renderPetRequestModal = (req) => {
    const statusUiMap = {
      'новая': 'Новая',
      'в обработке': 'В обработке',
      'одобрена': 'Одобрена',
      'отклонена': 'Отклонена',
      'закрыта': 'Закрыта',
    };
    const statusClassMap = {
      'новая': 'new',
      'в обработке': 'processing',
      'одобрена': 'approved',
      'отклонена': 'rejected',
      'закрыта': 'closed',
    };
    const rawStatus = String(req.status || 'новая').toLowerCase();
    const statusLabel = statusUiMap[rawStatus] || req.status || 'Новая';
    const statusClass = statusClassMap[rawStatus] || 'new';
    const created = req.created_at ? String(req.created_at).replace('T', ' ') : '—';
    petRequestModalContent.innerHTML = `
      <div class="admin-modal-grid">
        <p><b>№ заявки:</b> ${esc(req.id)}</p>
        <p><b>Питомец:</b> ${esc(req.animal_name || `ID ${req.animal_id}`)}</p>
        <p><b>ФИО:</b> ${esc(req.full_name || '—')}</p>
        <p><b>Телефон:</b> ${esc(req.phone || '—')}</p>
        <p><b>Email:</b> ${esc(req.email || '—')}</p>
        <p><b>Создана:</b> ${esc(created)}</p>
      </div>
      <div class="admin-modal-block"><b>Условия содержания:</b><div>${esc(req.living_conditions || '—')}</div></div>
      <div class="admin-modal-block"><b>Опыт содержания:</b><div>${esc(req.experience || '—')}</div></div>
      <div class="admin-modal-block"><b>Доп. комментарии:</b><div>${esc(req.additional_comments || '—')}</div></div>
      <p class="admin-modal-current-status">Текущий статус: <span class="pet-status pet-status--${statusClass}">${esc(statusLabel)}</span></p>
    `;

    state.activePetRequestStatus = req.status || '';
    petStatusBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.requestStatus === state.activePetRequestStatus);
    });
  };

  const openPetRequestModal = async (requestId) => {
    if (!petRequestModal || !petRequestModalContent) return;
    state.activePetRequestId = requestId;
    petRequestModalMessage.textContent = '';
    petRequestModalMessage.className = 'admin-modal-message';
    petRequestModalContent.innerHTML = '<p class="admin-empty">Загрузка...</p>';
    petRequestModal.classList.add('open');
    petRequestModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const { response, payload } = await apiRequest(`admin/animal-requests/${requestId}`, { method: 'GET' });
    if (!response.ok || !payload.ok || !payload.request) {
      petRequestModalContent.innerHTML = `<p class="admin-empty">${esc(payload.message || 'Не удалось загрузить заявку')}</p>`;
      return;
    }
    renderPetRequestModal(payload.request);
  };

  const closePetRequestModal = () => {
    if (!petRequestModal) return;
    petRequestModal.classList.remove('open');
    petRequestModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    state.activePetRequestId = 0;
    state.activePetRequestStatus = '';
  };

  const updatePetRequestInState = (requestId, status) => {
    state.pet = state.pet.map((item) => item.id === requestId ? { ...item, status } : item);
    renderPet();
  };

  const removePetRequestFromState = (requestId) => {
    state.pet = state.pet.filter((item) => item.id !== requestId);
    renderPet();
  };

  const renderReg = () => {
    const list = state.reg;
    if (!list.length) {
      registrationRequestsRoot.innerHTML = '<div class="admin-empty">Заявок на регистрацию пока нет.</div>';
      if (registrationToggleBtn) registrationToggleBtn.style.display = 'none';
      return;
    }
    const visible = state.regExpanded ? list : list.slice(0, COLLAPSED_LIMIT);
    registrationRequestsRoot.innerHTML = visible.map((i) => {
      const actions = i.status === 'ожидает'
        ? `<div class="reg-actions"><button class="reg-btn approve" data-action="approve" data-id="${i.id}">Подтвердить</button><button class="reg-btn reject" data-action="reject" data-id="${i.id}">Отклонить</button></div>`
        : `<p class="reg-status ${i.status === 'одобрена' ? 'approved' : 'rejected'}">${esc(i.status)}</p>`;
      return `<article class="reg-card"><p class="reg-name">${esc(i.username)}</p><p class="reg-meta">${esc(i.phone)}<br />${esc(i.email)}</p><p class="reg-text">${esc(i.additional_info || '—')}</p>${actions}</article>`;
    }).join('');

    if (registrationToggleBtn) {
      registrationToggleBtn.style.display = list.length > COLLAPSED_LIMIT ? 'inline-block' : 'none';
      registrationToggleBtn.textContent = state.regExpanded ? 'Свернуть' : 'Смотреть все заявки';
    }
  };

  const load = async () => {
    const me = await apiRequest('me', { method: 'GET' });
    if (!me.response.ok || !me.payload.ok || me.payload.user?.role !== 'admin') {
      window.location.href = 'login.html';
      return;
    }

    const [petRes, regRes] = await Promise.all([
      apiRequest('admin/animal-requests', { method: 'GET' }),
      apiRequest('admin/registration-requests', { method: 'GET' }),
    ]);

    if (!petRes.response.ok || !petRes.payload.ok || !regRes.response.ok || !regRes.payload.ok) {
      showMessage('Не удалось загрузить заявки.', 'error');
      return;
    }

    state.pet = petRes.payload.requests || [];
    state.reg = regRes.payload.requests || [];
    renderPet();
    renderReg();
    showMessage('');
  };

  petToggleBtn?.addEventListener('click', () => { state.petExpanded = !state.petExpanded; renderPet(); });
  registrationToggleBtn?.addEventListener('click', () => { state.regExpanded = !state.regExpanded; renderReg(); });

  petRequestsRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-open-pet-request]');
    if (!btn) return;
    const requestId = Number(btn.getAttribute('data-open-pet-request'));
    if (!requestId) return;
    openPetRequestModal(requestId);
  });

  petRequestModal?.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) closePetRequestModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && petRequestModal?.classList.contains('open')) {
      closePetRequestModal();
    }
  });

  document.querySelector('.admin-modal-actions')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-request-status]');
    if (!btn || !state.activePetRequestId) return;
    const nextStatus = btn.dataset.requestStatus;
    if (!nextStatus) return;

    petStatusBtns.forEach((b) => { b.disabled = true; });
    const { response, payload } = await apiRequest(`admin/animal-requests/${state.activePetRequestId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: nextStatus }),
    });
    petStatusBtns.forEach((b) => { b.disabled = false; });

    if (!response.ok || !payload.ok) {
      petRequestModalMessage.textContent = payload.message || 'Не удалось обновить статус';
      petRequestModalMessage.className = 'admin-modal-message error';
      return;
    }

    petRequestModalMessage.textContent = payload.message || 'Статус обновлен';
    petRequestModalMessage.className = 'admin-modal-message ok';
    state.activePetRequestStatus = payload.status || nextStatus;
    petStatusBtns.forEach((b) => b.classList.toggle('active', b.dataset.requestStatus === state.activePetRequestStatus));
    updatePetRequestInState(state.activePetRequestId, state.activePetRequestStatus);

    const detail = await apiRequest(`admin/animal-requests/${state.activePetRequestId}`, { method: 'GET' });
    if (detail.response.ok && detail.payload.ok && detail.payload.request) {
      renderPetRequestModal(detail.payload.request);
    }
  });

  petDeleteBtn?.addEventListener('click', async () => {
    if (!state.activePetRequestId) return;
    if (!window.confirm('Удалить эту заявку? Действие нельзя отменить.')) return;

    petStatusBtns.forEach((b) => { b.disabled = true; });
    petDeleteBtn.disabled = true;

    const { response, payload } = await apiRequest(`admin/animal-requests/${state.activePetRequestId}/delete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    petStatusBtns.forEach((b) => { b.disabled = false; });
    petDeleteBtn.disabled = false;

    if (!response.ok || !payload.ok) {
      petRequestModalMessage.textContent = payload.message || 'Не удалось удалить заявку';
      petRequestModalMessage.className = 'admin-modal-message error';
      return;
    }

    const deletedId = state.activePetRequestId;
    petRequestModalMessage.textContent = payload.message || 'Заявка удалена';
    petRequestModalMessage.className = 'admin-modal-message ok';
    removePetRequestFromState(deletedId);
    setTimeout(() => {
      closePetRequestModal();
    }, 250);
  });

  registrationRequestsRoot.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action][data-id]');
    if (!btn) return;
    btn.disabled = true;
    const { response, payload } = await apiRequest(`admin/registration-requests/${btn.dataset.id}/${btn.dataset.action}`, { method: 'POST', body: JSON.stringify({}) });
    if (!response.ok || !payload.ok) {
      showMessage(payload.message || 'Ошибка обновления заявки', 'error');
      btn.disabled = false;
      return;
    }
    showMessage(payload.message || 'Заявка обновлена', 'ok');
    await load();
  });

  load();
}


// ЛИЧНЫЙ КАБИНЕТ СОТРУДНИКА

const workerProcessingRoot = document.querySelector('#worker-processing-grid');
const workerNewRoot = document.querySelector('#worker-new-grid');
if (workerProcessingRoot && workerNewRoot) {
  const workerMessageEl = document.querySelector('#worker-message');
  const workerToggleBtn = document.querySelector('[data-toggle-section="worker-all"]');
  const workerModal = document.querySelector('#worker-request-modal');
  const workerModalContent = document.querySelector('#worker-request-modal-content');
  const workerModalMessage = document.querySelector('#worker-request-modal-message');
  const workerStatusBtns = [...document.querySelectorAll('.worker-status-btn[data-request-status]')];
  const profileName = document.querySelector('#worker-profile-name');
  const profilePhone = document.querySelector('#worker-profile-phone');
  const profileEmail = document.querySelector('#worker-profile-email');
  const COLLAPSED_LIMIT = 6;
  const state = { expanded: false, all: [], activeRequestId: 0, activeRequestStatus: '' };

  const showMessage = (text, type = '') => {
    if (!workerMessageEl) return;
    workerMessageEl.textContent = text;
    workerMessageEl.className = `worker-message${type ? ` ${type}` : ''}`;
  };

  const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const statusUiMap = {
    'новая': 'Новая',
    'в обработке': 'Обработка',
    'одобрена': 'Одобрена',
    'отклонена': 'Отклонена',
    'закрыта': 'Закрыта',
  };
  const statusClassMap = {
    'новая': 'new',
    'в обработке': 'processing',
    'одобрена': 'approved',
    'отклонена': 'rejected',
    'закрыта': 'closed',
  };

  const cardHtml = (i) => {
    const rawStatus = String(i.status || 'новая').toLowerCase();
    const statusText = statusUiMap[rawStatus] || i.status || 'Новая';
    const statusClass = statusClassMap[rawStatus] || 'new';
    const petLabel = i.animal_name || (i.animal_id ? `ID ${i.animal_id}` : 'Заявка');
    return `<article class="worker-card"><div class="worker-card-top"><span class="worker-status worker-status--${statusClass}">${esc(statusText)}</span><span class="worker-number">№${String(i.id).padStart(3, '0')}</span></div><p>${esc(petLabel)}</p><button type="button" class="worker-detail" data-open-worker-request="${i.id}">Подробнее</button></article>`;
  };

  const render = () => {
    const processingList = state.all.filter((i) => String(i.status || '').toLowerCase() === 'в обработке');
    workerProcessingRoot.innerHTML = processingList.length ? processingList.map(cardHtml).join('') : '<div class="admin-empty">Нет заявок в работе.</div>';

    const newOnly = state.all.filter((i) => String(i.status || '').toLowerCase() === 'новая');
    const visible = state.expanded ? newOnly : newOnly.slice(0, COLLAPSED_LIMIT);
    workerNewRoot.innerHTML = visible.length ? visible.map(cardHtml).join('') : '<div class="admin-empty">Новых заявок нет.</div>';

    if (workerToggleBtn) {
      workerToggleBtn.style.display = newOnly.length > COLLAPSED_LIMIT ? 'inline-block' : 'none';
      workerToggleBtn.textContent = state.expanded ? 'Свернуть' : 'Смотреть все заявки';
    }
  };

  const renderModal = (req) => {
    const rawStatus = String(req.status || 'новая').toLowerCase();
    const statusLabel = statusUiMap[rawStatus] || req.status || 'Новая';
    const statusClass = statusClassMap[rawStatus] || 'new';
    const created = req.created_at ? String(req.created_at).replace('T', ' ') : '—';
    workerModalContent.innerHTML = `
      <div class="worker-modal-grid">
        <p><b>№ заявки:</b> ${esc(req.id)}</p>
        <p><b>Питомец:</b> ${esc(req.animal_name || `ID ${req.animal_id}`)}</p>
        <p><b>ФИО:</b> ${esc(req.full_name || '—')}</p>
        <p><b>Телефон:</b> ${esc(req.phone || '—')}</p>
        <p><b>Email:</b> ${esc(req.email || '—')}</p>
        <p><b>Создана:</b> ${esc(created)}</p>
      </div>
      <div class="worker-modal-block"><b>Условия содержания:</b><div>${esc(req.living_conditions || '—')}</div></div>
      <div class="worker-modal-block"><b>Опыт содержания:</b><div>${esc(req.experience || '—')}</div></div>
      <div class="worker-modal-block"><b>Доп. комментарии:</b><div>${esc(req.additional_comments || '—')}</div></div>
      <p class="worker-modal-current-status">Текущий статус: <span class="worker-status worker-status--${statusClass}">${esc(statusLabel)}</span></p>
    `;

    state.activeRequestStatus = req.status || '';
    workerStatusBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.requestStatus === state.activeRequestStatus);
    });
  };

  const openModal = async (requestId) => {
    if (!workerModal || !workerModalContent) return;
    state.activeRequestId = requestId;
    workerModalMessage.textContent = '';
    workerModalMessage.className = 'worker-modal-message';
    workerModalContent.innerHTML = '<p class="admin-empty">Загрузка...</p>';
    workerModal.classList.add('open');
    workerModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const { response, payload } = await apiRequest(`worker/animal-requests/${requestId}`, { method: 'GET' });
    if (!response.ok || !payload.ok || !payload.request) {
      workerModalContent.innerHTML = `<p class="admin-empty">${esc(payload.message || 'Не удалось загрузить заявку')}</p>`;
      return;
    }
    renderModal(payload.request);
  };

  const closeModal = () => {
    if (!workerModal) return;
    workerModal.classList.remove('open');
    workerModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    state.activeRequestId = 0;
    state.activeRequestStatus = '';
  };

  const updateRequestInState = (requestId, status) => {
    state.all = state.all.map((item) => item.id === requestId ? { ...item, status } : item);
    render();
  };

  const load = async () => {
    const me = await apiRequest('me', { method: 'GET' });
    if (!me.response.ok || !me.payload.ok) {
      window.location.href = 'login.html';
      return;
    }

    const user = me.payload.user;
    if (user.role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    if (user.role !== 'worker') {
      window.location.href = HOME_PATH;
      return;
    }

    if (profileName) profileName.textContent = user.username || 'Работник';
    if (profilePhone) profilePhone.textContent = user.phone || 'Телефон не указан';
    if (profileEmail) profileEmail.textContent = user.email || 'Email не указан';

    const res = await apiRequest('worker/animal-requests', { method: 'GET' });
    if (!res.response.ok || !res.payload.ok) {
      showMessage('Не удалось загрузить заявки.', 'error');
      return;
    }

    state.all = res.payload.requests || [];
    render();
    showMessage('');
  };

  workerToggleBtn?.addEventListener('click', () => {
    state.expanded = !state.expanded;
    render();
  });

  workerProcessingRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-open-worker-request]');
    if (!btn) return;
    const requestId = Number(btn.getAttribute('data-open-worker-request'));
    if (!requestId) return;
    openModal(requestId);
  });

  workerNewRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-open-worker-request]');
    if (!btn) return;
    const requestId = Number(btn.getAttribute('data-open-worker-request'));
    if (!requestId) return;
    openModal(requestId);
  });

  workerModal?.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && workerModal?.classList.contains('open')) {
      closeModal();
    }
  });

  document.querySelector('.worker-modal-actions')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-request-status]');
    if (!btn || !state.activeRequestId) return;
    const nextStatus = btn.dataset.requestStatus;
    if (!nextStatus) return;

    workerStatusBtns.forEach((b) => { b.disabled = true; });
    const { response, payload } = await apiRequest(`worker/animal-requests/${state.activeRequestId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: nextStatus }),
    });
    workerStatusBtns.forEach((b) => { b.disabled = false; });

    if (!response.ok || !payload.ok) {
      workerModalMessage.textContent = payload.message || 'Не удалось обновить статус';
      workerModalMessage.className = 'worker-modal-message error';
      return;
    }

    workerModalMessage.textContent = payload.message || 'Статус обновлен';
    workerModalMessage.className = 'worker-modal-message ok';
    state.activeRequestStatus = payload.status || nextStatus;
    workerStatusBtns.forEach((b) => b.classList.toggle('active', b.dataset.requestStatus === state.activeRequestStatus));
    updateRequestInState(state.activeRequestId, state.activeRequestStatus);

    const detail = await apiRequest(`worker/animal-requests/${state.activeRequestId}`, { method: 'GET' });
    if (detail.response.ok && detail.payload.ok && detail.payload.request) {
      renderModal(detail.payload.request);
    }
  });

  load();
}


// СТАТИСТИКА

const statsRoot = document.querySelector('#stats-root');
if (statsRoot) {
  const statsMessage = document.querySelector('#stats-message');
  const setStatsMessage = (text, type = '') => {
    if (!statsMessage) return;
    statsMessage.textContent = text;
    statsMessage.className = `stats-message${type ? ` ${type}` : ''}`;
  };

  const setText = (id, value) => {
    const el = document.querySelector(`#${id}`);
    if (el) el.textContent = String(value ?? 0);
  };

  const loadStats = async () => {
    const me = await apiRequest('me', { method: 'GET' });
    if (!me.response.ok || !me.payload.ok) {
      window.location.href = 'login.html';
      return;
    }

    const user = me.payload.user;
    if (user.role === 'worker') {
      window.location.href = 'worker.html';
      return;
    }
    if (user.role !== 'admin') {
      window.location.href = HOME_PATH;
      return;
    }

    const { response, payload } = await apiRequest('admin/stats', { method: 'GET' });
    if (!response.ok || !payload.ok) {
      setStatsMessage(payload.message || 'Не удалось загрузить статистику.', 'error');
      return;
    }

    const kpi = payload.kpi || {};
    const animals = payload.animals_by_status || {};
    const requests = payload.animal_requests_by_status || {};

    setText('stats-kpi-new-requests', kpi.new_pet_requests);
    setText('stats-kpi-reg-pending', kpi.pending_registrations);
    setText('stats-kpi-animals-shelter', kpi.animals_in_shelter);
    setText('stats-kpi-adopted', kpi.adopted_total);

    setText('animals-seeking', animals['ищет дом']);
    setText('animals-foster', animals['на передержке']);
    setText('animals-adopted', animals['пристроен']);
    setText('animals-left', animals['выбыло']);
    setText('animals-total', animals.total);

    setText('req-new', requests['новая']);
    setText('req-processing', requests['в обработке']);
    setText('req-approved', requests['одобрена']);
    setText('req-rejected', requests['отклонена']);
    setText('req-closed', requests['закрыта']);
    setText('req-total', requests.total);

    setStatsMessage('');
  };

  loadStats();
}


