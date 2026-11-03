# CODA Quest VR Lab v16.2 — upgraded 3D models and hand tracking
CODA_REAL_CURL="$(type -P curl)"
CODA_OLD_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/d36171453_CODA-ESP32-3D-Editor-Arduino-v143.zip"
CODA_NEW_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/0f6e6141e_CODA-Quest-VR-Lab-Modelos-3D-v162.zip"
curl() {
  local args=() arg
  for arg in "$@"; do
    if [[ "$arg" == "$CODA_OLD_PACKAGE" ]]; then args+=("$CODA_NEW_PACKAGE")
    else args+=("$arg"); fi
  done
  "$CODA_REAL_CURL" "${args[@]}"
}
export CODA_REAL_CURL CODA_OLD_PACKAGE CODA_NEW_PACKAGE
export -f curl
