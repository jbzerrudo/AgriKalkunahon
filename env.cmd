@echo off
REM AgriKalkunahon build environment.
REM Node is not on PATH on this machine; it is borrowed from the Codex CLI runtime,
REM which can move when that tool updates. If the path below stops working, find it with:
REM     where /R "%USERPROFILE%" node.exe
set NODE="C:\Users\zerru001\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist %NODE% (
  echo node.exe not found at %NODE%
  echo Find it with:  where /R "%%USERPROFILE%%" node.exe
  exit /b 1
)
echo NODE set. Build with:  %%NODE%% build.js ^&^& %%NODE%% engine\test.js
