/**
 * RUthirsty Dialer - app.js
 * 联系人列表 + 拨号功能
 * 兼容 Cordova / Android / HarmonyOS
 */

'use strict';

/* ==========================================
   工具函数
   ========================================== */

/** 拼音首字母映射（覆盖常用汉字范围） */
const PINYIN_MAP = (function () {
  const ranges = [
    [19968, 'A'], [20024, 'B'], [20033, 'C'], [20103, 'D'], [20132, 'E'],
    [20163, 'F'], [20225, 'G'], [20252, 'H'], [20304, 'J'], [20405, 'K'],
    [20449, 'L'], [20508, 'M'], [20549, 'N'], [20609, 'O'], [20625, 'P'],
    [20653, 'Q'], [20702, 'R'], [20740, 'S'], [20856, 'T'], [20894, 'W'],
    [20950, 'X'], [21028, 'Y'], [21119, 'Z'], [40870, '#'],
  ];
  return function (char) {
    const code = char.charCodeAt(0);
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (code >= ranges[i][0]) return ranges[i][1];
    }
    return null;
  };
})();

/** 获取姓名首字母（中文取拼音首字母，英文直接大写） */
function getInitial(name) {
  if (!name) return '#';
  const first = name[0];
  if (/[\u4e00-\u9fa5]/.test(first)) return PINYIN_MAP(first) || '#';
  const up = first.toUpperCase();
  return /[A-Z]/.test(up) ? up : '#';
}

/** 生成头像背景色（由姓名 hash 决定） */
const AVATAR_COLORS = [
  '#1976D2','#388E3C','#D32F2F','#7B1FA2','#F57C00',
  '#0097A7','#C2185B','#455A64','#00796B','#5C6BC0',
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** 格式化电话号码（加空格方便阅读） */
function formatPhone(num) {
  const n = (num || '').replace(/\D/g, '');
  if (n.length === 11 && n[0] === '1') return n.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  if (n.length === 10) return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  return num;
}

/** 转义 HTML（防 XSS） */
function escHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

/** 高亮关键词 */
function highlight(text, kw) {
  if (!kw) return escHtml(text);
  const re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escHtml(text).replace(re, '<mark>$1</mark>');
}

/** 发起电话 */
function makeCall(number) {
  const raw = (number || '').replace(/\s/g, '');
  if (!raw) return;
  window.open('tel:' + raw, '_system');
}

/* ==========================================
   主应用
   ========================================== */
const App = (function () {

  let allContacts = [];   // 原始联系人数据
  let filteredContacts = []; // 当前筛选结果

  // DOM 引用
  const $ = id => document.getElementById(id);
  const els = {};

  function initEls() {
    const ids = [
      'btn-search', 'search-bar', 'search-input', 'btn-clear-search',
      'main-content', 'state-loading', 'state-denied', 'state-empty',
      'contacts-section', 'contact-count', 'alpha-nav', 'contact-list',
      'call-modal', 'modal-avatar', 'modal-name', 'modal-number',
      'btn-cancel-call', 'btn-confirm-call', 'btn-retry-permission',
      'btn-dialpad', 'dialpad-overlay', 'btn-dialpad-close',
      'dialpad-number', 'btn-backspace', 'btn-dial-call',
    ];
    ids.forEach(id => { els[id] = $(id); });
  }

  /* ---------- 状态切换 ---------- */
  function showState(name) {
    ['state-loading', 'state-denied', 'state-empty', 'contacts-section'].forEach(s => {
      els[s].classList.toggle('hidden', s !== name);
    });
  }

  /* ---------- 读取联系人 ---------- */
  function loadContacts() {
    showState('state-loading');

    // cordova-plugin-contacts-x API
    const fields = ['displayName', 'name', 'phoneNumbers'];
    const opts = { multiple: true, hasPhoneNumber: true };

    if (window.ContactsX) {
      ContactsX.find(
        fields,
        opts,
        onContactsSuccess,
        onContactsError
      );
    } else if (navigator.contacts) {
      // 回退到 cordova-plugin-contacts（已弃用但部分设备仍用）
      navigator.contacts.find(
        fields,
        onContactsSuccess,
        onContactsError,
        opts
      );
    } else {
      // 开发环境 / 浏览器预览：使用模拟数据
      setTimeout(() => onContactsSuccess(getMockContacts()), 600);
    }
  }

  function onContactsSuccess(contacts) {
    // 标准化为统一格式
    allContacts = contacts
      .map(c => {
        const name = (c.displayName || (c.name && c.name.formatted) || '').trim();
        const phones = (c.phoneNumbers || [])
          .map(p => ({ type: p.type || '', value: (p.value || '').trim() }))
          .filter(p => p.value);
        return { name, phones };
      })
      .filter(c => c.name && c.phones.length > 0)
      .sort((a, b) => getInitial(a.name).localeCompare(getInitial(b.name)) || a.name.localeCompare(b.name));

    filteredContacts = allContacts;
    renderContacts(allContacts);
  }

  function onContactsError(err) {
    console.warn('Contacts error:', err);
    const msg = (err && (err.message || err.toString())) || '';
    const isDenied = /denied|permission|unauthorized/i.test(msg);
    showState(isDenied ? 'state-denied' : 'state-empty');
  }

  /* ---------- 渲染联系人列表 ---------- */
  function renderContacts(contacts, kw) {
    if (!contacts || contacts.length === 0) {
      showState('state-empty');
      return;
    }

    showState('contacts-section');
    els['contact-count'].textContent = `共 ${contacts.length} 位联系人`;

    // 按首字母分组
    const groups = {};
    contacts.forEach(c => {
      const letter = getInitial(c.name);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });

    // 字母顺序
    const letters = Object.keys(groups).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });

    // 字母索引导航
    els['alpha-nav'].innerHTML = letters
      .map(l => `<a href="#group-${l}" data-letter="${l}">${l}</a>`)
      .join('');

    // 联系人列表
    const frag = document.createDocumentFragment();
    letters.forEach(letter => {
      // 分组标题
      const header = document.createElement('li');
      header.className = 'contact-group-header';
      header.id = `group-${letter}`;
      header.textContent = letter;
      frag.appendChild(header);

      groups[letter].forEach(contact => {
        const li = document.createElement('li');
        li.className = 'contact-item';
        li.setAttribute('role', 'listitem');

        const initials = contact.name.slice(0, 1);
        const color = avatarColor(contact.name);
        const highlightedName = highlight(contact.name, kw);
        const numbersHtml = contact.phones
          .slice(0, 2)
          .map(p => `<span class="contact-number">${highlight(formatPhone(p.value), kw)}</span>`)
          .join('');

        li.innerHTML = `
          <div class="contact-avatar" style="background:${color}">${escHtml(initials)}</div>
          <div class="contact-info">
            <div class="contact-name">${highlightedName}</div>
            <div class="contact-numbers">${numbersHtml}</div>
          </div>
          <button class="call-btn" aria-label="拨打 ${escHtml(contact.name)}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4
                1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1
                1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1
                1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
          </button>`;

        // 点击整行 → 选号（多号码时选第一个确认，单号码直接确认）
        li.addEventListener('click', e => {
          if (e.target.closest('.call-btn')) return; // call-btn 单独处理
          openCallModal(contact);
        });

        // 点击拨号按钮 → 直接拨第一个号码
        li.querySelector('.call-btn').addEventListener('click', e => {
          e.stopPropagation();
          if (contact.phones.length === 1) {
            makeCall(contact.phones[0].value);
          } else {
            openCallModal(contact);
          }
        });

        frag.appendChild(li);
      });
    });

    els['contact-list'].innerHTML = '';
    els['contact-list'].appendChild(frag);
  }

  /* ---------- 呼叫确认弹窗 ---------- */
  let currentCallNumber = '';

  function openCallModal(contact) {
    const phone = contact.phones[0].value;
    const color = avatarColor(contact.name);

    els['modal-avatar'].style.background = color;
    els['modal-avatar'].textContent = contact.name.slice(0, 1);
    els['modal-name'].textContent = contact.name;
    els['modal-number'].textContent = formatPhone(phone);
    currentCallNumber = phone;

    els['call-modal'].classList.remove('hidden');
  }

  function closeCallModal() {
    els['call-modal'].classList.add('hidden');
    currentCallNumber = '';
  }

  /* ---------- 搜索 ---------- */
  let searchOpen = false;

  function toggleSearch() {
    searchOpen = !searchOpen;
    els['search-bar'].classList.toggle('collapsed', !searchOpen);
    els['main-content'].classList.toggle('search-open', searchOpen);
    if (searchOpen) {
      els['search-input'].focus();
    } else {
      els['search-input'].value = '';
      applyFilter('');
    }
  }

  function applyFilter(kw) {
    const q = kw.trim().toLowerCase();
    if (!q) {
      filteredContacts = allContacts;
      renderContacts(allContacts);
      return;
    }
    filteredContacts = allContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phones.some(p => p.value.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    );
    renderContacts(filteredContacts, kw.trim());
  }

  /* ---------- 拨号盘 ---------- */
  let dialpadNumber = '';

  function updateDialpadDisplay() {
    els['dialpad-number'].textContent = dialpadNumber;
    els['btn-backspace'].classList.toggle('hidden', dialpadNumber.length === 0);
    els['btn-dial-call'].disabled = dialpadNumber.length === 0;
  }

  function appendDigit(d) {
    if (dialpadNumber.length >= 20) return;
    dialpadNumber += d;
    updateDialpadDisplay();
  }

  function backspaceDigit() {
    if (dialpadNumber.length === 0) return;
    dialpadNumber = dialpadNumber.slice(0, -1);
    updateDialpadDisplay();
  }

  /* ---------- 初始化事件 ---------- */
  function bindEvents() {
    // 搜索切换
    els['btn-search'].addEventListener('click', toggleSearch);
    els['search-input'].addEventListener('input', e => applyFilter(e.target.value));
    els['btn-clear-search'].addEventListener('click', () => {
      els['search-input'].value = '';
      applyFilter('');
      els['search-input'].focus();
    });

    // 重新请求权限
    els['btn-retry-permission'].addEventListener('click', loadContacts);

    // 呼叫弹窗
    els['btn-cancel-call'].addEventListener('click', closeCallModal);
    els['btn-confirm-call'].addEventListener('click', () => {
      makeCall(currentCallNumber);
      closeCallModal();
    });
    els['call-modal'].addEventListener('click', e => {
      if (e.target === els['call-modal']) closeCallModal();
    });

    // FAB 拨号盘
    els['btn-dialpad'].addEventListener('click', () => {
      dialpadNumber = '';
      updateDialpadDisplay();
      els['dialpad-overlay'].classList.remove('hidden');
    });
    els['btn-dialpad-close'].addEventListener('click', () => {
      els['dialpad-overlay'].classList.add('hidden');
    });
    els['dialpad-overlay'].addEventListener('click', e => {
      if (e.target === els['dialpad-overlay']) els['dialpad-overlay'].classList.add('hidden');
    });

    // 拨号键
    document.querySelectorAll('.dial-key').forEach(btn => {
      btn.addEventListener('click', () => appendDigit(btn.dataset.digit));
      // 长按 0 → +
      if (btn.dataset.digit === '0') {
        let timer;
        btn.addEventListener('touchstart', () => { timer = setTimeout(() => appendDigit('+'), 600); }, { passive: true });
        btn.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
      }
    });

    els['btn-backspace'].addEventListener('click', backspaceDigit);
    els['btn-backspace'].addEventListener('contextmenu', e => {
      e.preventDefault();
      dialpadNumber = '';
      updateDialpadDisplay();
    });

    els['btn-dial-call'].addEventListener('click', () => {
      if (dialpadNumber) {
        makeCall(dialpadNumber);
        els['dialpad-overlay'].classList.add('hidden');
      }
    });

    // 字母索引点击平滑滚动
    els['alpha-nav'].addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      const target = document.getElementById(`group-${a.dataset.letter}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 硬件返回键（Android / HarmonyOS）
    document.addEventListener('backbutton', () => {
      if (!els['dialpad-overlay'].classList.contains('hidden')) {
        els['dialpad-overlay'].classList.add('hidden');
        return;
      }
      if (!els['call-modal'].classList.contains('hidden')) {
        closeCallModal();
        return;
      }
      if (searchOpen) {
        toggleSearch();
        return;
      }
      navigator.app && navigator.app.exitApp();
    }, false);
  }

  /* ---------- 模拟数据（仅供浏览器预览） ---------- */
  function getMockContacts() {
    return [
      { displayName: '张三', phoneNumbers: [{ type: 'mobile', value: '13800138001' }] },
      { displayName: '李四', phoneNumbers: [{ type: 'mobile', value: '13912345678' }] },
      { displayName: '王芳', phoneNumbers: [{ type: 'mobile', value: '18612345678' }, { type: 'work', value: '010-88886666' }] },
      { displayName: '赵磊', phoneNumbers: [{ type: 'mobile', value: '13666668888' }] },
      { displayName: '陈晓明', phoneNumbers: [{ type: 'mobile', value: '15912345678' }] },
      { displayName: '刘洋', phoneNumbers: [{ type: 'mobile', value: '17712345678' }] },
      { displayName: '周静', phoneNumbers: [{ type: 'mobile', value: '13512345678' }] },
      { displayName: '吴昊', phoneNumbers: [{ type: 'mobile', value: '13412345678' }] },
      { displayName: 'Alice', phoneNumbers: [{ type: 'mobile', value: '13712345678' }] },
      { displayName: 'Bob', phoneNumbers: [{ type: 'mobile', value: '18812345678' }] },
      { displayName: '急救', phoneNumbers: [{ type: 'emergency', value: '120' }] },
      { displayName: '火警', phoneNumbers: [{ type: 'emergency', value: '119' }] },
    ];
  }

  /* ---------- 入口 ---------- */
  function init() {
    initEls();
    bindEvents();

    // 初始搜索栏折叠
    els['search-bar'].classList.add('collapsed');

    loadContacts();
  }

  return { init };
})();

/* ==========================================
   Cordova 设备就绪
   ========================================== */
document.addEventListener('deviceready', App.init, false);

// 浏览器环境兼容（没有 deviceready 时直接初始化）
if (!window.cordova) {
  document.addEventListener('DOMContentLoaded', App.init, false);
}
