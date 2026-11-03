# CODA Quest VR Lab v16.0 — Render build redirect.
# The Render build command is managed separately. Redirect only its old package URL.
CODA_REAL_CURL="$(type -P curl)"
CODA_OLD_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/d36171453_CODA-ESP32-3D-Editor-Arduino-v143.zip"
CODA_NEW_PACKAGE="https://media.base44.com/files/public/6adfa0d4abd10f5201650211/a6176723d_CODA-Quest-VR-Lab-v160.zip"

curl() {
  local args=()
  local arg
  for arg in "$@"; do
    if [[ "$arg" == "$CODA_OLD_PACKAGE" ]]; then
      args+=("$CODA_NEW_PACKAGE")
    else
      args+=("$arg")
    fi
  done
  "$CODA_REAL_CURL" "${args[@]}"
}
export CODA_REAL_CURL CODA_OLD_PACKAGE CODA_NEW_PACKAGE
export -f curl
