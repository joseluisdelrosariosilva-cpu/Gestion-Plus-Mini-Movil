@echo off
echo ========================================
echo COMPILAR APK - GESTION +
echo ========================================
echo.
echo Estableciendo variables...
set JAVA_HOME=C:\Program Files\Java\jdk-26.0.1
set ANDROID_HOME=C:\Users\Jose\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo.
echo Limpiando build anterior...
cd /d C:\Users\Jose\Desktop\GP-movil\webapp-beta\android
if exist "app\build" rmdir /s /q "app\build"

echo.
echo Instalando dependencias...
cd /d C:\Users\Jose\Desktop\GP-movil\webapp-beta
call npm install

echo.
echo Sincronizando Capacitor...
call npx cap sync android

echo.
echo Compilando APK...
cd /d C:\Users\Jose\Desktop\GP-movil\webapp-beta\android
call "C:\gradle-9.4.1-bin\gradle-9.4.1\bin\gradle.bat" clean assembleDebug --no-daemon --no-configuration-cache

echo.
echo ========================================
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo ✅ APK CREADA EXITOSAMENTE!
    echo.
    echo Ubicacion:
    echo   app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Copiala a tu telefono para instalar.
) else (
    echo ❌ Error: No se pudo crear la APK
)
echo ========================================
pause
