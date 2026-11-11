; Extra Windows set-up for AK Smarts PDF (used by electron-builder's NSIS installer).
; - lists the app under Settings > Apps > Default apps, so it can be chosen as the PDF app
; - adds it to "Open with" for .pdf files with the AK Smarts PDF file icon
; - asks Windows to refresh file icons straight away
!macro customInstall
  WriteRegStr SHCTX "Software\AKSmartsPDF\Capabilities" "ApplicationName" "AK Smarts PDF"
  WriteRegStr SHCTX "Software\AKSmartsPDF\Capabilities" "ApplicationDescription" "Read, edit, sign, compress and convert PDF files."
  WriteRegStr SHCTX "Software\AKSmartsPDF\Capabilities\FileAssociations" ".pdf" "AKSmartsPDF.Document"
  WriteRegStr SHCTX "Software\RegisteredApplications" "AK Smarts PDF" "Software\AKSmartsPDF\Capabilities"
  WriteRegStr SHCTX "Software\Classes\AKSmartsPDF.Document" "" "PDF Document"
  WriteRegStr SHCTX "Software\Classes\AKSmartsPDF.Document" "FriendlyTypeName" "PDF Document"
  WriteRegStr SHCTX "Software\Classes\AKSmartsPDF.Document\DefaultIcon" "" "$INSTDIR\resources\pdf-file.ico,0"
  WriteRegStr SHCTX "Software\Classes\AKSmartsPDF.Document\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHCTX "Software\Classes\.pdf\OpenWithProgids" "AKSmartsPDF.Document" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".pdf" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "AK Smarts PDF"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  DeleteRegValue SHCTX "Software\RegisteredApplications" "AK Smarts PDF"
  DeleteRegKey SHCTX "Software\AKSmartsPDF"
  DeleteRegValue SHCTX "Software\Classes\.pdf\OpenWithProgids" "AKSmartsPDF.Document"
  DeleteRegKey SHCTX "Software\Classes\AKSmartsPDF.Document"
  DeleteRegKey SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
