// build-installer.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Начинаем сборку установщика MurFlame Launcher...\n');

// 1. Проверка наличия electron-builder
console.log('📦 Проверка electron-builder...');
try {
  execSync('npx electron-builder --version', { stdio: 'pipe' });
  console.log('✅ electron-builder найден');
} catch (error) {
  console.error('❌ electron-builder не найден. Установите: npm install --save-dev electron-builder');
  process.exit(1);
}

// 2. Сборка Electron приложения
console.log('\n📦 Сборка Electron приложения...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Electron приложение собрано');
} catch (error) {
  console.error('❌ Ошибка сборки:', error.message);
  process.exit(1);
}

// 3. Сборка через electron-builder
console.log('\n🔧 Сборка установщика через electron-builder...');
try {
  execSync('npx electron-builder --win --x64', { stdio: 'inherit' });
  console.log('\n✅ Установщик успешно создан!');
  console.log('   📁 Файл: release/MurFlame_Setup_1.0.0.exe');
} catch (error) {
  console.error('❌ Ошибка electron-builder:', error.message);
  process.exit(1);
}

console.log('\n🎉 Готово! Установщик находится в папке release/');