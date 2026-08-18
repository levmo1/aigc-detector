; Remove runtime files created beside the executable after NSIS has closed the app
; and removed the files recorded by the installer.
; Keep them during an in-place update so user settings and history survive upgrades.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    RMDir /r /REBOOTOK "$INSTDIR\config"
    RMDir /r /REBOOTOK "$INSTDIR\data"
    RMDir /r /REBOOTOK "$INSTDIR\rules"
    RMDir /r /REBOOTOK "$INSTDIR\logs"
    RMDir /r /REBOOTOK "$INSTDIR\tesseract-data"
    RMDir /REBOOTOK "$INSTDIR"
  ${EndIf}
!macroend
