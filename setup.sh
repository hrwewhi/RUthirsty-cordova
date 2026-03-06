#!/usr/bin/env bash
# setup.sh — 首次搭建项目环境
# 用法: bash setup.sh

set -e

echo "==== RUthirsty Dialer — Cordova 环境初始化 ===="

# 1. 安装 npm 依赖
echo "[1/5] 安装 npm 依赖..."
npm install

# 2. 添加 Android 平台（鸿蒙兼容模式走 Android 通道）
echo "[2/5] 添加 Android 平台..."
npx cordova platform add android@12 --save 2>/dev/null || echo "  平台已存在，跳过"

# 3. 添加插件
echo "[3/5] 安装 Cordova 插件..."
npx cordova plugin add cordova-plugin-contacts-x --save 2>/dev/null || echo "  contacts-x 已安装"
npx cordova plugin add cordova-plugin-device --save 2>/dev/null      || echo "  device 已安装"
npx cordova plugin add cordova-plugin-statusbar --save 2>/dev/null   || echo "  statusbar 已安装"

# 4. 构建 Debug 包
echo "[4/5] 构建 Debug APK..."
npx cordova build android

# 5. 完成
echo ""
echo "[5/5] 完成！"
echo "  APK 路径: platforms/android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "  直接运行到设备: npx cordova run android"
echo "  鸿蒙设备请先在「开发者选项」中启用 USB 调试，然后运行上述命令。"
