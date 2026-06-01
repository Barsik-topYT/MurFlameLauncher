// build-installer.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Начинаем сборку установщика MurFlame Launcher...\n');

// 1. Сборка Electron приложения
console.log('📦 Сборка Electron приложения...');
try {
  execSync('npm run build:electron', { stdio: 'inherit' });
  execSync('npm run build:vite', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Ошибка сборки:', error.message);
  process.exit(1);
}

// 2. Сборка через electron-builder
console.log('\n🔧 Сборка исполняемых файлов через electron-builder...');
try {
  execSync('npx electron-builder --win --x64 --dir', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Ошибка electron-builder:', error.message);
  process.exit(1);
}

// 3. Создаём папки
if (!fs.existsSync('installer')) {
  fs.mkdirSync('installer');
}
if (!fs.existsSync('assets')) {
  fs.mkdirSync('assets');
  console.log('⚠️  Создана папка assets. Добавьте туда icon.ico');
}

// 4. Проверка наличия иконки
if (!fs.existsSync('assets/icon.ico')) {
  console.log('⚠️  Иконка не найдена: assets/icon.ico');
  console.log('   Создайте иконку 256x256 и сохраните как assets/icon.ico');
}

// 5. Проверка наличия LICENSE.txt
if (!fs.existsSync('LICENSE.txt')) {
  console.log('⚠️  Файл LICENSE.txt не найден');
  console.log('   Создайте файл LICENSE.txt с текстом лицензии');
}

// 6. Путь к Inno Setup Compiler
const isccPaths = [
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
];

let isccPath = null;
for (const p of isccPaths) {
  if (fs.existsSync(p)) {
    isccPath = p;
    break;
  }
}

if (!isccPath) {
  console.error('\n❌ Inno Setup не найден!');
  console.log('   Скачайте и установите Inno Setup с: https://jrsoftware.org/isdl.php');
  console.log('   Убедитесь, что установлен в стандартную папку');
  console.log('\n💡 Альтернатива: используйте electron-builder без Inno Setup');
  console.log('   Запустите: npm run dist:electron');
  process.exit(1);
}

// 7. Компиляция установщика
console.log('\n🔧 Компиляция установщика Inno Setup...');
try {
  execSync(`"${isccPath}" installer.iss`, { stdio: 'inherit' });
  console.log('\n✅ Установщик успешно создан!');
  console.log('   📁 Файл: installer/MurFlame_Setup.exe');
  console.log('\n🎉 Готово! Запустите installer/MurFlame_Setup.exe для установки');
} catch (error) {
  console.error('❌ Ошибка при компиляции установщика:', error.message);
}