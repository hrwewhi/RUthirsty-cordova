/**
 * RUthirsty Dialer — 老年人极简拨号
 * 界面：头像 + 电话 + 上一个/下一个
 */

'use strict';

/* ——————————————————————————
   语音朗读姓名（Web Speech API）
   —————————————————————————— */
function speakName(name) {
  if (!window.speechSynthesis || !name) return;
  // 取消当前正在朗读的内容
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(name);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;   // 语速略慢，方便老年人听清
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

/* ——————————————————————————
   头像背景色（由姓名 hash 决定）
   —————————————————————————— */
const AVATAR_COLORS = [
  '#1565C0', '#2E7D32', '#6A1B9A', '#AD1457',
  '#00838F', '#E65100', '#4527A0', '#00695C',
  '#558B2F', '#283593',
];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ——————————————————————————
   格式化电话号码（加空格）
   —————————————————————————— */
function formatPhone(num) {
  const n = (num || '').replace(/\D/g, '');
  if (n.length === 11 && n[0] === '1') {
    return n.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  }
  if (n.length === 10) {
    return n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  }
  return num || '';
}

/* ——————————————————————————
   发起电话
   —————————————————————————— */
function makeCall(number) {
  const raw = (number || '').replace(/\s/g, '');
  if (!raw) return;
  window.open('tel:' + raw, '_system');
}

/* ==========================================
   主应用
   ========================================== */
const App = (function () {

  let contacts = [];   // 标准化后的联系人列表
  let currentIndex = 0;

  const $ = id => document.getElementById(id);

  /* —— DOM 引用 —— */
  const el = {
    loading:      () => $('state-loading'),
    denied:       () => $('state-denied'),
    empty:        () => $('state-empty'),
    mainView:     () => $('main-view'),
    name:         () => $('contact-name'),
    avatar:       () => $('contact-avatar'),
    phone:        () => $('contact-phone'),
    btnPrev:      () => $('btn-prev'),
    btnNext:      () => $('btn-next'),
    index:        () => $('contact-index'),
    btnRetry:     () => $('btn-retry'),
  };

  /* —— 显示状态视图 —— */
  function showState(state) {
    el.loading().classList.toggle('hidden', state !== 'loading');
    el.denied().classList.toggle('hidden',  state !== 'denied');
    el.empty().classList.toggle('hidden',   state !== 'empty');
    el.mainView().classList.toggle('hidden', state !== 'main');
  }

  /* ——————————————————————————
     读取联系人
     —————————————————————————— */
  function loadContacts() {
    showState('loading');

    const fields = ['displayName', 'name', 'phoneNumbers', 'photos'];
    const opts   = { multiple: true, hasPhoneNumber: true };

    if (window.ContactsX) {
      ContactsX.find(fields, opts, onSuccess, onError);
    } else if (navigator.contacts) {
      navigator.contacts.find(fields, onSuccess, onError, opts);
    } else {
      setTimeout(() => onSuccess(getMockContacts()), 500);
    }
  }

  function onSuccess(raw) {
    contacts = raw
      .map(c => {
        const name = (c.displayName || (c.name && c.name.formatted) || '').trim();
        const phones = (c.phoneNumbers || [])
          .map(p => (p.value || '').trim())
          .filter(Boolean);
        // 取第一张照片（base64 data URI）
        const photo = (c.photos && c.photos[0] && c.photos[0].value) || null;
        return { name, phones, photo };
      })
      .filter(c => c.name && c.phones.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

    if (contacts.length === 0) {
      showState('empty');
      return;
    }

    currentIndex = 0;
    renderCurrent();
    showState('main');
  }

  function onError(err) {
    const msg = (err && (err.message || err.toString())) || '';
    const isDenied = /denied|permission|unauthorized/i.test(msg);
    showState(isDenied ? 'denied' : 'empty');
  }

  /* ——————————————————————————
     渲染当前联系人
     —————————————————————————— */
  function renderCurrent() {
    const c     = contacts[currentIndex];
    const total = contacts.length;

    // 姓名
    el.name().textContent = c.name;

    // 头像
    const avatarEl = el.avatar();
    if (c.photo) {
      // 有照片：背景图
      avatarEl.style.backgroundImage = `url(${c.photo})`;
      avatarEl.style.background = '';
      avatarEl.textContent = '';
    } else {
      // 无照片：首字 + 色块
      avatarEl.style.backgroundImage = '';
      avatarEl.style.background = avatarColor(c.name);
      avatarEl.textContent = c.name.slice(0, 1);
    }

    // 电话（显示第一个号码）
    el.phone().textContent = formatPhone(c.phones[0]);
    el.phone().dataset.number = c.phones[0];

    // 序号
    el.index().textContent = `${currentIndex + 1} / ${total}`;

    // 导航按钮禁用状态
    el.btnPrev().disabled = currentIndex === 0;
    el.btnNext().disabled = currentIndex === total - 1;
  }

  /* ——————————————————————————
     绑定事件
     —————————————————————————— */
  function bindEvents() {
    // 姓名点击 → 语音朗读
    el.name().addEventListener('click', () => {
      const name = contacts[currentIndex] && contacts[currentIndex].name;
      speakName(name);
    });

    // 头像点击 → 拨号
    el.avatar().addEventListener('click', () => {
      if (contacts.length) makeCall(contacts[currentIndex].phones[0]);
    });

    // 电话按钮点击 → 拨号
    el.phone().addEventListener('click', () => {
      const num = el.phone().dataset.number;
      if (num) makeCall(num);
    });

    // 上一个
    el.btnPrev().addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderCurrent();
      }
    });

    // 下一个
    el.btnNext().addEventListener('click', () => {
      if (currentIndex < contacts.length - 1) {
        currentIndex++;
        renderCurrent();
      }
    });

    // 重新授权
    el.btnRetry().addEventListener('click', loadContacts);

    // 硬件返回键（Android / HarmonyOS）
    document.addEventListener('backbutton', () => {
      navigator.app && navigator.app.exitApp();
    }, false);
  }

  /* ——————————————————————————
     模拟数据（浏览器预览用）
     —————————————————————————— */
  function getMockContacts() {
    return [
      { displayName: '张三',   phoneNumbers: [{ value: '13800138001' }], photos: [] },
      { displayName: '李四',   phoneNumbers: [{ value: '13912345678' }], photos: [] },
      { displayName: '王芳',   phoneNumbers: [{ value: '18612345678' }], photos: [] },
      { displayName: '赵磊',   phoneNumbers: [{ value: '13666668888' }], photos: [] },
      { displayName: '陈晓明', phoneNumbers: [{ value: '15912345678' }], photos: [] },
      { displayName: '刘洋',   phoneNumbers: [{ value: '17712345678' }], photos: [] },
      { displayName: '急救',   phoneNumbers: [{ value: '120' }],         photos: [] },
      { displayName: '火警',   phoneNumbers: [{ value: '119' }],         photos: [] },
    ];
  }

  /* ——————————————————————————
     入口
     —————————————————————————— */
  function init() {
    bindEvents();
    loadContacts();
  }

  return { init };
})();

/* ==========================================
   Cordova 设备就绪
   ========================================== */
document.addEventListener('deviceready', App.init, false);

// 浏览器环境兼容
if (!window.cordova) {
  document.addEventListener('DOMContentLoaded', App.init, false);
}
