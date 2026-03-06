# RUthirsty Dialer — Cordova 拨号应用

手机联系人列表 + 一键拨号，兼容 Android 及 HarmonyOS（鸿蒙）设备。

## 功能

| 功能 | 说明 |
|------|------|
| 联系人列表 | 读取手机通讯录，按拼音首字母分组排序 |
| 字母索引 | 右侧快速跳转索引栏 |
| 搜索 | 按姓名或号码实时过滤，关键词高亮 |
| 拨号确认 | 点击联系人弹出确认卡片后拨打 |
| 快速拨号 | 点击行内 📞 按钮直接拨出 |
| 拨号盘 | 右下角浮动按钮打开数字拨号盘，支持长按 0 输入 + |
| 返回键 | Android/鸿蒙硬件返回键逐层关闭弹层 |

## 项目结构

```
RUthirsty-cordova/
├── config.xml              # Cordova 核心配置（权限、插件声明）
├── package.json            # npm / Cordova 依赖
├── setup.sh                # 一键初始化脚本
├── res/
│   └── xml/
│       └── network_security_config.xml   # Android 网络安全策略
└── www/
    ├── index.html          # 主界面（联系人列表 + 拨号盘）
    ├── css/
    │   └── style.css       # 全部样式
    └── js/
        └── app.js          # 应用逻辑
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- JDK 11 或 17
- Android SDK（API Level 22–33）
- Cordova CLI：`npm install -g cordova`

### 初始化（推荐）

```bash
bash setup.sh
```

### 手动步骤

```bash
# 安装依赖
npm install

# 添加 Android 平台
cordova platform add android@12

# 安装插件
cordova plugin add cordova-plugin-contacts-x
cordova plugin add cordova-plugin-device
cordova plugin add cordova-plugin-statusbar

# 构建 Debug APK
cordova build android

# 直接运行到已连接设备
cordova run android
```

## 鸿蒙（HarmonyOS）设备说明

HarmonyOS 4.x 及以下版本支持 Android 兼容模式，可直接安装 APK：

1. 手机进入 **设置 → 开发者选项** 开启 USB 调试
2. 连接电脑后执行 `cordova run android`
3. 首次运行时系统会弹出 **"读取联系人"** 权限请求，请点击**允许**
4. 系统同样会请求 **CALL_PHONE** 权限，点击**允许**

> **HarmonyOS NEXT（纯鸿蒙内核）** 不支持直接安装 APK。
> 如需支持 NEXT，请将本项目的 `www/` 目录内容迁移至华为 DevEco Studio 的 ArkWeb 混合开发模板，联系人与拨号接口替换为鸿蒙原生 API：
> - 联系人：`@ohos.contact`
> - 拨号：`@ohos.telephony.call`

## 插件说明

| 插件 | 用途 |
|------|------|
| `cordova-plugin-contacts-x` | 读取系统联系人（替代已弃用的 `cordova-plugin-contacts`） |
| `cordova-plugin-device` | 获取设备平台信息 |
| `cordova-plugin-statusbar` | 状态栏颜色适配 |

## 权限

`config.xml` 已声明：

- `android.permission.READ_CONTACTS` — 读取联系人
- `android.permission.CALL_PHONE` — 直接拨号

## 浏览器预览

```bash
# 无需真实设备，直接在浏览器中预览（使用模拟联系人数据）
cordova serve
# 然后访问 http://localhost:8000
```
