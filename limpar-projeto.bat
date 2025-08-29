@echo off
echo 🔄 Limpando projeto React Native...

REM Apagar node_modules
echo 🧹 Removendo node_modules...
rd /s /q node_modules

REM Apagar cache do npm
echo 🧹 Limpando cache do npm...
npm cache clean --force

REM Apagar diretórios de build do Android
echo 🧹 Removendo build do Android...
rd /s /q android\build
rd /s /q android\app\build

REM Apagar arquivos de lock
echo 🧹 Removendo package-lock.json...
del package-lock.json

REM Reinstalar dependências
echo 📦 Instalando dependências...
npm install

REM Limpar cache do Metro bundler
echo 🚀 Limpando cache do Metro bundler...
npx expo start -c

echo ✅ Limpeza concluída!
pause